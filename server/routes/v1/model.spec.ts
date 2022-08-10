import mongoose from 'mongoose'
import '../../utils/mockMongo'
import UserModel from '../../models/User'
import ModelModel from '../../models/Model'
import DeploymentModel from '../../models/Deployment'
import SchemaModel from '../../models/Schema'
import VersionModel from '../../models/Version'
import { authenticatedGetRequest, validateTestRequest } from '../../utils/test/testUtils'
import {
  testUser,
  uploadSchema,
  testModel,
  modelId,
  testVersion,
  modelUuid,
  testDeployment,
} from '../../utils/test/testModels'
import _ from 'lodash'

describe('test model routes', () => {
  beforeEach(async () => {
    const updatedTestModel = _.cloneDeep(testModel)
    await SchemaModel.create(uploadSchema)
    await UserModel.create(testUser)
    await DeploymentModel.create(testDeployment)
    const version = await VersionModel.create(testVersion)
    updatedTestModel.versions.push(version._id)
    await ModelModel.create(updatedTestModel)
  })

  test('that we can fetch all models', async () => {
    const res = await authenticatedGetRequest('/api/v1/models?type=all&filter=')
    validateTestRequest(res)
    expect(res.body.models[0].uuid).toBe(modelUuid)
  })

  test('that we can fetch all model by UUID', async () => {
    const res = await authenticatedGetRequest(`/api/v1/model/uuid/${modelUuid}`)
    validateTestRequest(res)
    expect(res.body.uuid).toBe(modelUuid)
  })

  test('that we can fetch all model by id', async () => {
    const res = await authenticatedGetRequest(`/api/v1/model/id/${modelId}`)
    validateTestRequest(res)
    expect(res.body.uuid).toBe(modelUuid)
  })

  test('that we can fetch deployments for a model', async () => {
    const res = await authenticatedGetRequest(`/api/v1/model/${modelUuid}/deployments`)
    validateTestRequest(res)
    expect(res.body.length).not.toBe(0)
    expect(res.body[0].uuid).toBe('test-deployment')
  })

  test('that we can fetch schema for model', async () => {
    const res = await authenticatedGetRequest(`/api/v1/model/${modelUuid}/schema`)
    validateTestRequest(res)
    expect(res.body.reference).toBe('test-schema')
  })

  test('that we can fetch versions for a model', async () => {
    const res = await authenticatedGetRequest(`/api/v1/model/${modelUuid}/versions`)
    validateTestRequest(res)
    expect(res.body.length).not.toBe(0)
    expect(res.body[0].version).toBe('1')
  })

  test('that we can fetch a specific version for a model', async () => {
    const res = await authenticatedGetRequest(`/api/v1/model/${modelUuid}/version/${'1'}`)
    validateTestRequest(res)
    expect(res.body).not.toBe(undefined)
    expect(res.body.version).toBe('1')
  })

  afterAll((done) => {
    mongoose.connection.close()
    done()
  })
})
