import { mkdir, exec, rm } from 'shelljs'
import { v4 as uuidv4 } from 'uuid'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { writeFile } from 'fs/promises'
import * as tar from 'tar'
import unzip from 'unzipper'

import config from 'config'
import dedent from 'dedent-js'
import uploadToS3 from './s3Utils'
import { getClient } from './minio'
import logger from './logger'
import { getAdminToken } from '../routes/v1/registryAuth'
import { VersionDoc } from '../models/Version'
import { ModelDoc } from '../models/Model'

interface FileRef {
  path: string
  bucket: string
  name: string
}

interface BuilderFiles {
  binary: FileRef
  code: FileRef
}

export async function pullBuilderImage() {
  await logCommand(`img pull ${config.get('s2i.builderImage')}`, (level: string, message: string) =>
    logger[level](message)
  )
}

async function createWorkingDirectory(): Promise<string> {
  const directory = join(tmpdir(), uuidv4())
  await mkdir(directory)

  return directory
}

async function downloadFile(remote: FileRef, local: string) {
  const minio = getClient()
  await minio.fGetObject(remote.bucket, remote.path, local)
}

async function deleteMinioFile(remote: FileRef) {
  const minio = getClient()
  await minio.removeObject(remote.bucket, remote.path)
}

async function unzipFile(zipPath: string) {
  const outputDir = dirname(zipPath)

  await unzip.Open.file(zipPath).then((d) => d.extract({ path: outputDir, concurrency: 5 }))
}

export async function logCommand(command: string, log: Function) {
  log('info', `$ ${command}`)

  return await runCommand(
    command,
    (data: string) => data.split(/\r?\n/).map((msg: string) => log('info', msg)),
    (data: string) => data.split(/\r?\n/).map((msg: string) => log('info', msg))
  )
}

export async function runCommand(command: string, onStdout: Function, onStderr: Function, opts: any = {}) {
  const childProcess = exec(command, { async: true, silent: true })
  childProcess.stdout!.on('data', (data) => {
    onStdout(data.trim())
  })

  childProcess.stderr!.on('data', (data) => {
    onStderr(data.trim())
  })

  await new Promise((resolve, reject) => {
    childProcess.on('exit', () => {
      if (childProcess.exitCode !== 0 && !opts.silentErrors) {
        return reject(
          `Failed with status code '${childProcess.exitCode}'${opts.hide ? '' : ` when running '${command}'`}`
        )
      }

      return resolve({})
    })
  })
}

export async function buildPython(version: VersionDoc, builderFiles: BuilderFiles): Promise<string> {
  const vlog = logger.child({ versionId: version._id })
  const tmpDir = await createWorkingDirectory()

  // zip paths
  const binaryPath = join(tmpDir, 'binary.zip')
  const codePath = join(tmpDir, 'code.zip')

  // download code bundles
  vlog.info({ builderFiles }, 'Downloading code bundles')
  await Promise.all([downloadFile(builderFiles.binary, binaryPath), downloadFile(builderFiles.code, codePath)])

  // unzip both files
  vlog.info({ binaryPath, codePath }, 'Unzipping files')
  await Promise.all([unzipFile(binaryPath), unzipFile(codePath)])

  // remove zip files
  vlog.info({ binaryPath, codePath }, 'Removing temp files')
  rm(binaryPath, codePath)

  // add metadata
  vlog.info('Adding in model environment data')
  const modelEnvs = dedent(`
    MODEL_NAME=Model
    API_TYPE=REST
    SERVICE_TYPE=MODEL
    PERSISTENCE=0
    PIP_NO_CACHE_DIR=off
    INCLUDE_METRICS_IN_CLIENT_RESPONSE=false
  `)

  const s2iDir = join(tmpDir, '.s2i')
  mkdir('-p', s2iDir)
  await writeFile(join(s2iDir, 'environment'), modelEnvs)

  // make Dockerfile
  const builder = config.get('s2i.builderImage')
  const builderScriptsUrl = '/s2i/bin'
  const buildDir = await createWorkingDirectory()
  const buildDockerfile = join(buildDir, 'Dockerfile')
  const tag = `${config.get('registry.host')}/internal/${(version.model as ModelDoc).uuid}:${version.version}`
  const toDockerfileTags = `--copy --as-dockerfile ${buildDockerfile} --scripts-url image://${builderScriptsUrl} --assemble-user root`
  const command = `${config.get('s2i.path')} build ${tmpDir} ${builder} ${toDockerfileTags}`
  vlog.info({ builder, tag, command }, 'Making Dockerfile')
  await logCommand(command, version.log.bind(version))

  // build image
  const buildCommand = `img build -f ${buildDockerfile} -t ${tag} ${buildDir}`
  vlog.info({ buildCommand }, 'Building')
  await logCommand(buildCommand, version.log.bind(version))

  // push image
  vlog.info({ tag }, 'Pushing image to docker')
  version.log('info', 'Logging into docker')
  // using docker instead of img login because img reads from ~/.docker/config and
  // does not fully populate authorization headers (clientId and account) in authorization
  // requests like docker does. docker login doesn't require docker to be running in host
  await runCommand(
    `docker login ${config.get('registry.host')} -u admin -p ${await getAdminToken()}`,
    vlog.info.bind(vlog),
    vlog.info.bind(vlog),
    { hide: true }
  )
  version.log('info', 'Successfully logged into docker')

  await logCommand(`img push ${tag}`, version.log.bind(version))
  const tarPath = join(tmpDir, `${(version.model as ModelDoc).uuid}-${version.version}`)
  await tar.c(
    {
      gzip: true,
      file: tarPath,
    },
    [tmpDir]
  )

  uploadToS3(tarPath)

  // tidy up
  vlog.info({ tmpDir, builderFiles, s2iDir }, 'Removing temp directories and Minio uploads')
  rm('-rf', tmpDir)
  rm('-rf', buildDir)
  rm('-rf', s2iDir)

  await Promise.all([deleteMinioFile(builderFiles.binary), deleteMinioFile(builderFiles.code)])
  const removeImageCmd = `img rm ${tag}`
  await logCommand(removeImageCmd, (level: string, message: string) => logger[level](message))

  return tag
}
