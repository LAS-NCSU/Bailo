import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import config from 'config'
import prettyMs from 'pretty-ms'
import https from 'https'
import fetch from 'cross-fetch'
import { Version } from '@/types/interfaces'
import { Model } from 'server/models/Model'
import { connectToMongoose, disconnectFromMongoose } from '../utils/database'
import UserModel from '../models/User'
import logger from '../utils/logger'
import { getAccessToken } from '../routes/v1/registryAuth'
import { findVersionById, markVersionState } from '../services/version'

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})

async function deleteImage(
  tagNamespace: string,
  modelId: string,
  modelVersion: string,
  version: Version
): Promise<Response> {
  const registry = `https://localhost:5000/v2`

  version.log('info', `Requesting a delete of image with tag. /${tagNamespace}/${modelId}/manifests/${modelVersion}`)

  logger.info(`Requesting a delete of image with tag. /${tagNamespace}/${modelId}/manifests/${modelVersion}`)

  const token = await getAccessToken({ id: 'admin', _id: 'admin' }, [
    { type: 'repository', name: `${tagNamespace}/${modelId}`, actions: ['pull', 'delete'] },
  ])
  const authorisation = `Bearer ${token}`

  const manifest = await fetch(`${registry}/${tagNamespace}/${modelId}/manifests/${modelVersion}`, {
    headers: {
      Accept: 'application/vnd.docker.distribution.manifest.v2+json',
      Authorization: authorisation,
    },
    agent: httpsAgent,
  } as RequestInit).then((res: any) => {
    logger.info({
      status: res.status,
    })
    if (res.status === 200) {
      return res.json()
    }

    throw new Error(`Failed to retrieve version: status:${res.status}`)
  })

  return fetch(`${registry}/${tagNamespace}/${modelId}/manifests/${manifest.config.digest}`, {
    method: 'DELETE',
    headers: {
      Authorization: authorisation,
    },
    agent: httpsAgent,
  } as RequestInit).then((res: any) => {
    logger.info({
      status: res.status,
    })
    return res
  })
}

;(async () => {
  await connectToMongoose()

  const argv = await yargs(hideBin(process.argv)).usage('deployment: $0 [uuid]').argv

  const versionId = argv._
  const user = await UserModel.findOne({
    id: 'user',
  })

  if (!user) {
    throw new Error('Unable to find user')
  }
  try {
    const startTime = new Date()

    if (!user) {
      logger.error('Unable to find deployment owner')
      throw new Error('Unable to find deployment owner')
    }

    if (!user) {
      logger.error('Unable to find model owner')
      throw new Error('Unable to find model owner')
    }

    const version = await findVersionById(user, versionId, { populate: true })
    if (!version) {
      throw new Error(`Unable to find version '${versionId}'`)
    }

    const vlog = logger.child({ versionId: version._id })

    if (version.state?.deleted === true) {
      logger.error(`Model version with id: ${versionId} already deleted.`)
      throw new Error(`Model version id: ${versionId} already deleted.`)
    }

    const { uuid: modelUuid } = version.model as Model

    const imageDeleteRes = await deleteImage('internal', modelUuid, version.version, version)

    const externalImage = `${config.get('registry.host')}/${user.id}/${modelUuid}:${version.version}`
    if (imageDeleteRes.status === 401) {
      version.log('info', `User is not Authorized to delete: ${externalImage}`)
      throw new Error(`User is not Authorized to delete: ${externalImage}`)
    }

    if (imageDeleteRes.status === 404) {
      version.log('info', `Image does not exist with tag: ${externalImage}`)
      throw new Error(`Image does not exist with tag: ${externalImage}`)
    }

    if (imageDeleteRes.status === 202) {
      version.log('info', 'Deleted model version')
      vlog.info('Marking model version as deleted')
      await markVersionState(user, version._id, 'deleted')
      // TODO
      // If I delete/retire a model version:
      // - Find all deployments of that model who's versions are less than or equal to that version
      //     - Determine if all deplopments are deleted:
      //         - Yes: Delete model version, this will let the container be destoryed.
      //         - No: Depricate model version and allow no new deployments. This will preserve the model container.
      // - If model has no deployments and has not been approved:
      //     - Delete

      // Total Clear:
      //     - Delete all versions of this model and deployments
      const time = prettyMs(new Date().getTime() - startTime.getTime())
      await version.log('info', `Deleted model version with tag '${externalImage}' in ${time}`)
    }
  } catch (e) {
    logger.error({ error: e, versionId }, 'Error occurred whilst deleting deployment')
    throw e
  }

  setTimeout(async () => {
    disconnectFromMongoose()
    process.exit(0)
  }, 50)
})()
