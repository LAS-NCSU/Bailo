import config from 'config'
import prettyMs from 'pretty-ms'
import https from 'https'
import { Model } from 'server/models/Model'
import { markModelDeleted } from '../services/model'
import { findModelVersions, findVersionById, markVersionState } from '../services/version'
import { getDeploymentDeleteQueue, getModelDeleteQueue } from '../utils/queues'
import logger from '../utils/logger'
import { getAccessToken } from '../routes/v1/registryAuth'
import { getUserByInternalId } from '../services/user'
import { findDeploymentById, markDeploymentDeleted } from '../services/deployment'

const httpsAgent = new https.Agent({
  rejectUnauthorized: !config.get('registry.insecure'),
})

async function deleteImage(tagNamespace: string, modelId: string, modelVersion: string): Promise<Response> {
  const registry = `https://${config.get('registry.host')}/v2`

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

    throw new Error(`Failed to retrieve image: status:${res.status}`)
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

export async function processDeploymentDelete() {
  ;(await getDeploymentDeleteQueue()).process(async (msg) => {
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

      deployment.log(
        'info',
        `Requesting a delete of image with tag. /${user.id}/${modelID}/manifests/${initialVersionRequested}`
      )
      const imageDeleteRes = await deleteImage(user.id, modelID, initialVersionRequested)

      const externalImage = `${config.get('registry.host')}/${user.id}/${modelID}:${initialVersionRequested}`
      if (imageDeleteRes.status === 401) {
        deployment.log('info', `User is not Authorized to delete: ${externalImage}`)
        throw new Error(`User is not Authorized to delete: ${externalImage}`)
      }

      if (imageDeleteRes.status === 404) {
        deployment.log('info', `Image does not exist with tag: ${externalImage}`)
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

export async function processModelDelete() {
  ;(await getModelDeleteQueue()).process(async (msg) => {
    logger.info({ job: msg.payload }, 'Started deleting model')
    try {
      const startTime = new Date()

      const { userId, versionId } = msg.payload

      const user = await getUserByInternalId(userId)

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

      version.log(
        'info',
        `Requesting a delete of image with tag. /'internal'/${modelUuid}/manifests/${version.version}`
      )
      const imageDeleteRes = await deleteImage('internal', modelUuid, version.version)

      const externalImage = `${config.get('registry.host')}/internal/${modelUuid}:${version.version}`
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

        // Check to see if a model has any non-delted versions
        // If there are no non-deleted version mark the model as deleted.
        const nonDeletedVersions = await findModelVersions(user, version.model, { deleted: false })
        if (!nonDeletedVersions || nonDeletedVersions.length === 0) {
          await markModelDeleted(version.model)
        }

        const time = prettyMs(new Date().getTime() - startTime.getTime())
        await version.log('info', `Deleted model version with tag '${externalImage}' in ${time}`)
      }
    } catch (e) {
      logger.error({ error: e, versionId: msg.payload.versionId }, 'Error occurred whilst deleting deployment')
      throw e
    }
  })
}
