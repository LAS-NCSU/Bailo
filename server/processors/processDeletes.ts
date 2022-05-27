import config from 'config'
import prettyMs from 'pretty-ms'
import https from 'https'
import { getDeleteQueue } from '../utils/queues'
import logger from '../utils/logger'
import { getAccessToken } from '../routes/v1/registryAuth'
import { getUserByInternalId } from '../services/user'
import { findDeploymentById, markDeploymentDeleted } from '../services/deployment'

const httpsAgent = new https.Agent({
  rejectUnauthorized: !config.get('registry.insecure'),
})

export default async function processDeploymentDelete() {
  ;(await getDeleteQueue()).process(async (msg) => {
    logger.info({ job: msg.payload }, 'Started deleting deployment')
    try {
      const startTime = new Date()

      const { deploymentId, userId } = msg.payload

      const user = await getUserByInternalId(userId)

      if (!user) {
        logger.error('Unable to find deployment owner')
        throw new Error('Unable to find deployment owner')
      }

      const deployment = await findDeploymentById(user, deploymentId, { populate: true })

      if (!deployment) {
        logger.error('Unable to find deployment')
        throw new Error('Unable to find deployment')
      }

      if (deployment.deleted) {
        logger.error(`Deployment with id: ${deploymentId} already deleted.`)
        throw new Error(`Deployment with id: ${deploymentId} already deleted.`)
      }

      const dlog = logger.child({ deploymentId: deployment._id })

      const { modelID, initialVersionRequested } = deployment.metadata.highLevelDetails

      const registry = `https://${config.get('registry.host')}/v2`
      const tag = `${modelID}:${initialVersionRequested}`
      const externalImage = `${config.get('registry.host')}/${user.id}/${tag}`

      deployment.log('info', `Deleting image tag.  Current: internal/${tag}`)

      const token = await getAccessToken({ id: 'admin', _id: 'admin' }, [
        { type: 'repository', name: `${user.id}/${modelID}`, actions: ['push', 'pull', 'delete'] },
      ])
      const authorisation = `Bearer ${token}`

      deployment.log('info', `Requesting ${registry}/${user.id}/${modelID}/manifests/${initialVersionRequested}`)

      const manifest = await fetch(`${registry}/${user.id}/${modelID}/manifests/${initialVersionRequested}`, {
        headers: {
          Accept: 'application/vnd.docker.distribution.manifest.v2+json',
          Authorization: authorisation,
        },
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

      if (imageDeleteRes.status === 202) {
        deployment.log('info', 'Deleted deployment')
        dlog.info('Marking deployment as deleted')
        await markDeploymentDeleted(deployment._id)
        const time = prettyMs(new Date().getTime() - startTime.getTime())
        await deployment.log('info', `Deleted deployment with tag '${externalImage}' in ${time}`)
      }
    } catch (e) {
      logger.error({ error: e, deploymentId: msg.payload.deploymentId }, 'Error occurred whilst deleting deployment')
      throw e
    }
  })
}
