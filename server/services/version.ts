import { castArray } from 'lodash'
import VersionModel, { VersionDoc } from '../models/Version'

import { Version, ModelId } from '../../types/interfaces'
import AuthorisationBase from '../utils/AuthorisationBase'
import { asyncFilter } from '../utils/general'
import { BadReq, Forbidden } from '../utils/result'
import { createSerializer, SerializerOptions } from '../utils/logger'
import { serializedModelFields } from './model'
import { UserDoc } from '../models/User'

const authorisation = new AuthorisationBase()

interface GetVersionOptions {
  thin?: boolean
  populate?: boolean
  deleted?: boolean
  limit?: number
}

export function isVersionRetired(version: Version): boolean {
  const {
    state: {
      build: { state },
    },
    built,
  } = version
  if (state === 'deleted') {
    return true
  }

  if (!built) {
    return true
  }

  return false
}

export function serializedVersionFields(): SerializerOptions {
  return {
    mandatory: ['_id', 'version', 'metadata.highLevelDetails.name'],
    optional: [],
    serializable: [{ type: createSerializer(serializedModelFields()), field: 'model' }],
  }
}

export async function filterVersion<T>(user: UserDoc, unfiltered: T): Promise<T> {
  const versions = castArray(unfiltered)

  const filtered = await asyncFilter(versions, (version: VersionDoc) => authorisation.canUserSeeVersion(user, version))

  return Array.isArray(unfiltered) ? (filtered as unknown as T) : filtered[0]
}

export async function findVersionById(user: UserDoc, id: ModelId, opts?: GetVersionOptions) {
  let version = VersionModel.findById(id)
  if (opts?.thin) version = version.select({ state: 0, logs: 0, metadata: 0 })
  if (opts?.populate) version = version.populate('model')

  return filterVersion(user, await version)
}

export async function findVersionByName(user: UserDoc, model: ModelId, name: string, opts?: GetVersionOptions) {
  let version = VersionModel.findOne({ model, version: name })
  if (opts?.thin) version = version.select({ state: 0, logs: 0, metadata: 0 })
  if (opts?.populate) version = version.populate('model')

  return filterVersion(user, await version)
}

export async function findModelVersions(user: UserDoc, model: ModelId, opts?: GetVersionOptions) {
  const query = { model }
  if (opts?.deleted === false) {
    query['state.build.state'] = { $ne: 'deleted' }
  }
  let versions = VersionModel.find(query).sort({ createdAt: -1 })

  if (opts?.thin) versions = versions.select({ state: 0, logs: 0, metadata: 0 })
  if (opts?.populate) versions = versions.populate('model')
  if (opts?.limit) {
    versions.limit(opts.limit)
  }

  return filterVersion(user, await versions)
}

export async function markVersionBuilt(_id: ModelId) {
  return VersionModel.findByIdAndUpdate(_id, { built: true })
}

export async function markVersionState(user: UserDoc, _id: ModelId, state: string) {
  const version = await findVersionById(user, _id)

  if (!version) {
    throw BadReq({ code: 'model_invalid_type', _id }, `Provided invalid version '${_id}'`)
  }

  const buildState: { build: { state: string; reason?: string } } = {
    build: {
      ...(version.state.build || {}),
      state,
    },
  }

  if (state === 'succeeded') {
    buildState.build.reason = undefined
  }

  version.state = buildState

  version.markModified('state')
  await version.save()
}

interface CreateVersion {
  version: string
  metadata: any
}

export async function createVersion(user: UserDoc, data: CreateVersion) {
  const version = new VersionModel(data)

  if (!authorisation.canUserSeeVersion(user, version)) {
    throw Forbidden({ data }, 'Unable to create version, failed permissions check.')
  }

  await version.save()

  return version
}
