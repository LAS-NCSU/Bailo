import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import config from 'config'
import prettyMs from 'pretty-ms'
import https from 'https'
import fetch from 'cross-fetch'
import { connectToMongoose, disconnectFromMongoose } from '../utils/database'
import UserModel from '../models/User'
import { findDeploymentById, markDeploymentRetired } from '../services/deployment'
import logger from '../utils/logger'
import { getAccessToken } from '../routes/v1/registryAuth'

const httpsAgent = new https.Agent({
  // rejectUnauthorized: !config.get('registry.insecure'),
  rejectUnauthorized: false,
})

;(async () => {
  await connectToMongoose()

  const argv = await yargs(hideBin(process.argv)).usage('deployment: $0 [uuid]').argv

  const deploymentId = argv._
  const user = await UserModel.findOne({
    id: 'user',
  })

  if (!user) {
    throw new Error('Unable to find user')
  }
  try {
    const startTime = new Date()

    // const { deploymentId, userId } = msg.payload

    // const user = await getUserByInternalId(userId)

    if (!user) {
      logger.error('Unable to find deployment owner')
      throw new Error('Unable to find deployment owner')
    }

    const deployment = await findDeploymentById(user, deploymentId, { populate: true })

    if (!deployment) {
      logger.error('Unable to find deployment')
      throw new Error('Unable to find deployment')
    }

    logger.info({ deploymentId: deployment._id })

    const { modelID, initialVersionRequested } = deployment.metadata.highLevelDetails

    // const registry = `https://${config.get('registry.host')}/v2`
    const registry = `https://localhost:5000/v2`
    const tag = `${modelID}:${initialVersionRequested}`
    const externalImage = `${config.get('registry.host')}/${user.id}/${tag}`

    logger.info('info', `Deleting image tag.  Current: internal/${tag}`)

    // const token = await getAccessToken({ id: 'admin', _id: 'admin' }, [
    const token = await getAccessToken({ id: 'admin', _id: 'admin' }, [
      { type: 'repository', name: `${user.id}/${modelID}`, actions: ['push', 'pull', 'delete'] },
    ])
    const authorisation = `Bearer ${token}`

    logger.info(`Requesting ${registry}/${user.id}/${modelID}/manifests/${initialVersionRequested}`)

    const manifest = await fetch(`${registry}/${user.id}/${modelID}/manifests/${initialVersionRequested}`, {
      headers: {
        Accept: 'application/vnd.docker.distribution.manifest.v2+json',
        Authorization: authorisation,
      },
      method: 'GET',
      agent: httpsAgent,
    } as RequestInit).then((res: any) => {
      logger.info({
        status: res.status,
      })
      return res.json()
    })

    const imageDeleteRes = await fetch(`${registry}/${user.id}/${modelID}/manifests/${manifest.config.digest}`, {
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

    if (imageDeleteRes.status === 401) {
      throw new Error(`User is not Authorized to delete: ${externalImage}`)
    }

    if (imageDeleteRes.status === 404) {
      throw new Error(`Image does not exist with tag: ${externalImage}`)
    }

    logger.info('info', 'Deleted deployment')
    logger.info('Marking deployment as deleted')
    await markDeploymentRetired(deployment._id)

    const time = prettyMs(new Date().getTime() - startTime.getTime())
    await logger.info('info', `Deleted deployment with tag '${externalImage}' in ${time}`)
  } catch (e) {
    logger.error({ error: e, deploymentId }, 'Error occurred whilst deleting deployment')
    throw e
  }

  setTimeout(async () => {
    disconnectFromMongoose()
    process.exit(0)
  }, 50)
})()
