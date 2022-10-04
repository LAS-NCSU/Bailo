import { castArray } from 'lodash'
import { Deployment, ModelId, DeploymentId } from '../../types/interfaces'
import DeploymentModel, { DeploymentDoc } from '../models/Deployment'
import { UserDoc } from '../models/User'
import { VersionDoc } from '../models/Version'
import Authorisation from '../external/Authorisation'
import { asyncFilter } from '../utils/general'
import { createSerializer, SerializerOptions } from '../utils/logger'
import { Forbidden } from '../utils/result'
import { serializedModelFields } from './model'

const auth = new Authorisation()

interface GetDeploymentOptions {
  populate?: boolean
}

export function isDeploymentRetired(deployment: Deployment): boolean {
  return deployment.retired
}

export function serializedDeploymentFields(): SerializerOptions {
  return {
    mandatory: ['_id', 'uuid', 'name'],
    optional: [],
    serializable: [{ type: createSerializer(serializedModelFields()), field: 'model' }],
  }
}

export async function filterDeployment<T>(user: UserDoc, unfiltered: T): Promise<T> {
  const deployments = castArray(unfiltered)

  const filtered = await asyncFilter(deployments, (deployment: DeploymentDoc) =>
    auth.canUserSeeDeployment(user, deployment)
  )

  return Array.isArray(unfiltered) ? (filtered as unknown as T) : filtered[0]
}

export async function findDeploymentByUuid(user: UserDoc, uuid: string, _opts?: GetDeploymentOptions) {
  let deployment = DeploymentModel.findOne({ uuid })
  deployment = deployment.populate('model', ['_id', 'uuid']).populate('versions', ['version', 'metadata'])

  return filterDeployment(user, await deployment)
}

export async function findDeploymentById(user: UserDoc, id: ModelId, opts?: GetDeploymentOptions) {
  let deployment = DeploymentModel.findById(id)
  if (opts?.populate) deployment = deployment.populate('model')

  return filterDeployment(user, await deployment)
}

export async function findDeploymentsByUuid(user: UserDoc, uuids: [DeploymentId], opts?: GetDeploymentOptions) {
  let deployments = DeploymentModel.find({ uuid: uuids })
  if (opts?.populate) deployments = deployments.populate('model')

  return filterDeployment(user, await deployments)
}

export interface DeploymentFilter {
  owner?: ModelId
  model?: ModelId
  retired?: boolean
}

export async function findDeployments(user: UserDoc, { owner, model, retired = false }: DeploymentFilter) {
  const query: any = {}

  query.retired = retired

  if (owner) query.owner = owner
  if (model) query.model = model

  const models = await DeploymentModel.find(query).sort({ updatedAt: -1 })
  return filterDeployment(user, models)
}

export async function markDeploymentBuilt(_id: ModelId) {
  return DeploymentModel.findByIdAndUpdate(_id, { built: true })
}

export async function markDeploymentRetired(_id: ModelId) {
  return DeploymentModel.findByIdAndUpdate(_id, { retired: true })
}

interface CreateDeployment {
  schemaRef: string
  uuid: string

  versions: Array<VersionDoc>
  model: ModelId
  metadata: any

  owner: ModelId
}

export async function createDeployment(user: UserDoc, data: CreateDeployment) {
  const deployment = new DeploymentModel(data)

  if (!(await auth.canUserSeeDeployment(user, deployment))) {
    throw Forbidden({ data }, 'Unable to create deployment, failed permissions check.')
  }

  await deployment.save()

  return deployment
}

export async function updateDeploymentVersions(user: UserDoc, modelId: ModelId, version: VersionDoc) {
  const deployments = await findDeployments(user, { model: modelId })
  if (deployments.length !== 0) {
    deployments.forEach((deployment: DeploymentDoc) => {
      deployment.versions.push(version)
      deployment.save()
    })
  }
}
