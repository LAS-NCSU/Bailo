import { Request, Response } from 'express'
import RequestModel from '../../models/Request'
import { findDeployments } from '../../services/deployment'
import { findModelById, findModelByUuid, findModels, isValidFilter, isValidType } from '../../services/model'
import { findSchemaByRef } from '../../services/schema'
import { findModelVersions, findVersionById, findVersionByName } from '../../services/version'
import { BadReq, NotFound } from '../../utils/result'
import { ensureUserRole } from '../../utils/user'

export const getModels = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    let { type, filter } = req.query

    if (filter === undefined) filter = ''
    if (type === undefined) type = 'all'

    if (!isValidType(type)) {
      throw BadReq({ code: 'model_invalid_type', type }, `Provided invalid type '${type}'`)
    }

    if (!isValidFilter(filter)) {
      throw BadReq({ code: 'model_invalid_filter', filter }, `Provided invalid filter '${filter}'`)
    }

    const models = await findModels(req.user, { filter: filter as string, type })

    req.log.info({ code: 'fetching_models', models }, 'User fetching all models')

    return res.json({
      models,
    })
  },
]

export const getModelByUuid = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    const { uuid } = req.params

    const model = await findModelByUuid(req.user, uuid)

    if (!model) {
      throw NotFound({ code: 'model_not_found', uuid }, `Unable to find model '${uuid}'`)
    }

    req.log.info({ code: 'fetch_model_by_uuid', model }, 'User fetching model by given UUID')
    return res.json(model)
  },
]

export const getModelById = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    const { id } = req.params

    const model = await findModelById(req.user, id)

    if (!model) {
      throw NotFound({ code: 'model_not_found', id }, `Unable to find model '${id}'`)
    }

    req.log.info({ code: 'fetch_model_by_id', model }, 'User fetching model by given ID')
    return res.json(model)
  },
]

export const getModelDeployments = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    const { uuid } = req.params

    const model = await findModelByUuid(req.user, uuid)

    if (!model) {
      throw NotFound({ code: 'model_not_found', uuid }, `Unable to find model '${uuid}'`)
    }

    const deployments = await findDeployments(req.user, { model: model._id })

    req.log.info(
      { code: 'fetch_deployments_by_model', modelId: model._id, deployments },
      'User fetching all deployments for model'
    )
    return res.json(deployments)
  },
]

export const getModelSchema = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    const { uuid } = req.params

    const model = await findModelByUuid(req.user, uuid)

    if (!model) {
      throw NotFound({ code: 'model_not_found', uuid }, `Unable to find model '${uuid}'`)
    }

    const schema = await findSchemaByRef(model.schemaRef)
    if (!schema) {
      throw NotFound(
        { code: 'schema_not_found', uuid, schemaRef: model.schemaRef },
        `Unable to find schema '${model.schemaRef}'`
      )
    }

    req.log.info({ code: 'fetch_model_schema', model }, 'User fetching model schema')
    return res.json(schema)
  },
]

export const getModelVersions = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    const { uuid } = req.params

    const model = await findModelByUuid(req.user, uuid)

    if (!model) {
      throw NotFound({ code: 'model_not_found', uuid }, `Unable to find model '${uuid}'`)
    }
    // Might need to add legacy {thin: true} prop
    const versions = await findModelVersions(req.user!, model._id, { retired: false })

    req.log.info(
      { code: 'fetch_versions_for_model', modelId: model._id, versions },
      'User fetching versions for specified model'
    )
    return res.json(versions)
  },
]

export const getModelVersion = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    const { uuid, version: versionName } = req.params

    const model = await findModelByUuid(req.user, uuid)

    if (!model) {
      throw NotFound({ code: 'model_not_found', uuid }, `Unable to find model '${uuid}'`)
    }

    if (versionName === 'latest') {
      const versions = await findModelVersions(req.user!, model._id, { retired: false, limit: 1 })
      if (versions.length === 0) {
        req.log.info({ code: 'version_not_found', versionName }, `Unable to find version '${versionName}'`)
        return res.json({})
      }

      return res.json(versions[0])
    }

    const version = await findVersionByName(req.user!, model._id, versionName)

    if (!version) {
      req.log.info({ code: 'version_not_found', versionName }, `Unable to find version '${versionName}'`)
      return res.json({})
    }

    req.log.info(
      { code: 'fetch_version_for_model', modelId: model._id, version },
      'User finding specific version for model'
    )
    return res.json(version)
  },
]

export const deleteModel = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    const { uuid } = req.params

    const model = await findModelByUuid(req.user, uuid)

    if (!model) {
      throw NotFound({ code: 'model_not_found', uuid }, `Unable to find model '${uuid}'`)
    }

    const versions = await findModelVersions(req.user!, model._id, { thin: true })
    if (versions.length > 0) {
      versions.forEach(async (version) => {
        const versionRequests = await RequestModel.find({ version: version._id })
        if (versionRequests.length > 0) {
          versionRequests.forEach((versionRequest) => {
            versionRequest.delete()
          })
        }
        version.delete()
      })
    }

    const deployments = await findDeployments(req.user!, { model: model._id })
    if (deployments.length > 0) {
      deployments.forEach(async (deployment) => {
        const deploymentRequests = await RequestModel.find({ deployment: deployment._id })
        if (deploymentRequests.length > 0) {
          deploymentRequests.forEach((deploymentRequest) => {
            deploymentRequest.delete()
          })
        }
        deployment.delete()
      })
    }

    model.delete()

    return res.json(uuid)
  },
]
