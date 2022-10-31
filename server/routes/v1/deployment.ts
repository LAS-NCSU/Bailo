import config from 'config'
import * as Minio from 'minio'
import { Request, Response } from 'express'
import bodyParser from 'body-parser'
import { customAlphabet } from 'nanoid'
import { Deployment } from '@/types/interfaces'
import { getUserById } from '../../services/user'
import { getDeploymentDeleteQueue } from '../../utils/queues'
import { ApprovalStates } from '../../../types/interfaces'
import { findVersionByName, isVersionRetired } from '../../services/version'
import {
  createDeployment,
  findDeploymentByUuid,
  findDeployments,
  findDeploymentsByUuid,
  isDeploymentRetired,
} from '../../services/deployment'
import { findModelByUuid } from '../../services/model'
import { createDeploymentRequests } from '../../services/request'
import { findSchemaByRef } from '../../services/schema'
import { BadReq, Forbidden, NotFound, Unauthorised } from '../../utils/result'
import { ensureUserRole } from '../../utils/user'
import { validateSchema } from '../../utils/validateSchema'
import { getUserById } from '../../services/user'

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6)

export const getDeployment = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    const { uuid } = req.params
    const { logs } = req.query
    const showLogs = logs === 'true'

    const deployment = await findDeploymentByUuid(req.user, uuid, { showLogs })

    if (!deployment) {
      throw NotFound({ code: 'deployment_not_found', uuid }, `Unable to find deployment '${uuid}'`)
    }

    req.log.info({ code: 'get_deployment_by_uuid', deployment }, 'Fetching deployment by a given UUID')
    return res.json(deployment)
  },
]

export const retireDeployments = [
  ensureUserRole('user'),
  bodyParser.json(),
  async (req: Request, res: Response) => {
    req.log.info({ code: 'requesting_deployment_delete' }, 'User requesting deployment delete')
    const body = req.body as any

    // TODO: validate that this user exists
    body.user = req.user?.id
    const user = await getUserById(body.user)

    if (!user) {
      req.log.error(`Can't request deployment deletion, invalid user`)
      throw BadReq({ code: 'user not found', user_id: body.user }, 'Unable to find deployment owner')
    }

    // TODO: Is this input santized anywhere?
    const deployments = (await findDeploymentsByUuid(user.id, body.uuids)).filter(
      (deployment: Deployment) => isDeploymentRetired(deployment) === false
    )

    if (!deployments.length) {
      throw NotFound(
        { code: 'deployments_not_found', uuids: body.uuids },
        `No unretired/existing deployments found with uuids: '${body.uuids}'`
      )
    }

    const jobId = await (
      await getDeploymentDeleteQueue()
    ).add(
      deployments.map((deployment) => {
        req.log.info(
          {
            code: 'delete_deployment_by_uuid',
            deployment: deployment.uuid,
          },
          'Deleting deployment by a given UUID'
        )
        return {
          deploymentId: deployment._id,
          userId: user._id,
        }
      })
    )

    req.log.info(
      { code: 'created_delete_deployment_job', jobId },
      'Successfully created job in delete deployment queue'
    )

    return res.json({ deployments: deployments.map((deployment) => deployment.uuid) })
  },
]

export const getCurrentUserDeployments = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    const { id } = req.params
    const { logs } = req.query
    const showLogs = logs === 'true'

    const deployments = await findDeployments(req.user, { owner: id }, { showLogs })

    req.log.info({ code: 'fetch_deployments_by_user', deployments }, 'Fetching deployments by user')

    return res.json(deployments)
  },
]

export const postDeployment = [
  ensureUserRole('user'),
  bodyParser.json(),
  async (req: Request, res: Response) => {
    req.log.info({ code: 'requesting_deployment' }, 'User requesting deployment')
    const { body } = req

    const schema = await findSchemaByRef(body.schemaRef)
    if (!schema) {
      throw NotFound(
        { code: 'schema_not_found', schemaRef: body.schemaRef },
        `Unable to find schema with name: '${body.schemaRef}'`
      )
    }

    body.user = req.user.id
    body.timeStamp = new Date().toISOString()

    // first, we verify the schema
    const schemaIsInvalid = validateSchema(body, schema.schema)
    if (schemaIsInvalid) {
      throw BadReq(
        { code: 'invalid_schema', errors: schemaIsInvalid, schemaRef: body.schemaRef },
        `Your deployment does not conform to the schema: '${body.schemaRef}'`
      )
    }

    const model = await findModelByUuid(req.user, body.highLevelDetails.modelID)

    if (!model) {
      throw NotFound(
        { code: 'model_not_found', modelId: body.highLevelDetails.modelID },
        `Unable to find model with name: '${body.highLevelDetails.modelID}'`
      )
    }

    req.log.info(
      { code: 'requesting_model_version', model, version: body.highLevelDetails.initialVersionRequested },
      'Requesting model version'
    )
    const version = await findVersionByName(req.user!, model._id, body.highLevelDetails.initialVersionRequested)

    if (!version) {
      throw NotFound(
        {
          code: 'version_not_found',
          modelId: body.highLevelDetails.modelID,
          version: body.highLevelDetails.initialVersionRequested,
        },
        `Unable to find version with name: '${body.highLevelDetails.initialVersionRequested}'`
      )
    }

    if (isVersionRetired(version)) {
      throw BadReq({ code: 'version_retired' }, 'Unable to create a deployment for a retired model version.')
    }

    const name = body.highLevelDetails.name
      .toLowerCase()
      .replace(/[^a-z 0-9]/g, '')
      .replace(/ /g, '-')

    const uuid = `${name}-${nanoid()}`
    req.log.info({ uuid }, `Named deployment '${uuid}'`)

    const versionArray = [version._id]

    const requesterId = body.contacts.requester
    const requester = await getUserById(requesterId)

    if (!requester) {
      throw NotFound({ code: 'requester_not_found' }, `Unable to find requester with name '${requesterId}'`)
    }

    const deployment = await createDeployment(req.user, {
      schemaRef: body.schemaRef,
      uuid,

      versions: versionArray,
      model: model._id,
      metadata: body,

      owner: requester._id,
    })

    req.log.info({ code: 'saving_deployment', deployment }, 'Saving deployment model')
    await deployment.save()

    req.log.info({ code: 'named_deployment', deploymentId: deployment._id }, `Named deployment '${uuid}'`)

    if (!version) {
      throw NotFound(
        { code: 'version_not_found', version: body.highLevelDetails.initialVersionRequested },
        `Unable to find version: '${body.highLevelDetails.initialVersionRequested}'`
      )
    }

    req.log.info({ code: 'requesting_model_version', modelId: model._id, version }, 'Requesting model version')

    const managerRequest = await createDeploymentRequests({
      version,
      deployment: await deployment.populate('model').execPopulate(),
    })
    req.log.info(
      { code: 'created_deployment', deploymentId: deployment._id, request: managerRequest._id, uuid },
      'Successfully created deployment'
    )

    res.json({
      uuid,
    })
  },
]

export const resetDeploymentApprovals = [
  ensureUserRole('user'),
  bodyParser.json(),
  async (req: Request, res: Response) => {
    const { user } = req
    const { uuid } = req.params
    const deployment = await findDeploymentByUuid(req.user, uuid)
    if (!deployment) {
      throw BadReq({ code: 'deployment_not_found', uuid }, `Unable to find requested deployment: '${uuid}'`)
    }
    if (user?.id !== deployment.metadata.contacts.requester) {
      throw Forbidden(
        { code: 'not_allowed_to_reset_approvals' },
        'You cannot reset the approvals for a deployment you do not own.'
      )
    }

    if (isDeploymentRetired(deployment)) {
      throw BadReq({ code: 'deployment_retired' }, 'Unable to reset approvals on a deployment that is retired.')
    }

    const version = await findVersionByName(
      user,
      deployment.model,
      deployment.metadata.highLevelDetails.initialVersionRequested
    )
    if (!version) {
      throw BadReq(
        {
          code: 'deployment_version_not_found',
          deploymentId: deployment._id,
          version: deployment.metadata.highLevelDetails.initialVersionRequested,
        },
        `Unable to find version for requested deployment: '${uuid}'`
      )
    }

    if (isVersionRetired(version)) {
      throw BadReq(
        { code: 'version_retired' },
        'Unable to reset approvals on a deployment with a model version that is retired/unbuilt.'
      )
    }

    deployment.managerApproved = ApprovalStates.NoResponse
    await deployment.save()
    req.log.info({ code: 'reset_deployment_approvals', deployment }, 'User resetting deployment approvals')
    await createDeploymentRequests({ version, deployment: await deployment.populate('model').execPopulate() })

    return res.json(deployment)
  },
]

export const fetchRawModelFiles = [
  ensureUserRole('user'),
  bodyParser.json(),
  async (req: Request, res: Response) => {
    const { uuid, version, fileType } = req.params
    const deployment = await findDeploymentByUuid(req.user, uuid)

    if (deployment === null) {
      throw NotFound({ deploymentUuid: uuid }, `Unable to find deployment for uuid ${uuid}`)
    }

    if (!req.user._id.equals(deployment.owner)) {
      throw Unauthorised(
        { deploymentOwner: deployment.owner },
        `User is not authorised to download this file. Requester: ${req.user._id}, owner: ${deployment.owner}`
      )
    }

    if (deployment.managerApproved !== 'Accepted') {
      throw Unauthorised(
        { approvalStatus: deployment.managerApproved },
        'User is not authorised to download this file as it has not been approved.'
      )
    }

    if (fileType !== 'code' && fileType !== 'binary') {
      throw NotFound({ fileType }, 'Unknown file type specified')
    }

    const versionDocument = await findVersionByName(req.user, deployment.model, version)
    const bucketName: string = config.get('minio.uploadBucket')
    const client = new Minio.Client(config.get('minio'))

    if (versionDocument === null) {
      throw NotFound({ versionId: version }, `Unable to find version for id ${version}`)
    }

    let filePath

    if (fileType === 'code') {
      filePath = versionDocument.files.rawCodePath
    }
    if (fileType === 'binary') {
      filePath = versionDocument.files.rawBinaryPath
    }

    // Stat object to get size so browser can determine progress
    const { size } = await client.statObject(bucketName, filePath)

    // res.set('Content-Disposition', contentDisposition(fileType, { type: 'inline' }))
    res.set('Content-disposition', `attachment; filename=${fileType}.zip`)
    res.set('Content-Type', 'application/zip')
    res.set('Cache-Control', 'private, max-age=604800, immutable')
    res.set('Content-Length', size.toString())
    res.writeHead(200)

    const stream = await client.getObject(bucketName, filePath)
    if (!stream) {
      throw NotFound({ code: 'object_fetch_failed', bucketName, filePath }, 'Failed to fetch object from storage')
    }
    stream.pipe(res)
  },
]
