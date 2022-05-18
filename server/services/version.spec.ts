import '../utils/mockMongo'
import { ObjectId } from 'mongodb'
import { ApprovalStates } from '../models/Deployment'
import VersionModel from '../models/Version'
import {
  createVersion,
  findModelVersions,
  findVersionById,
  findVersionByName,
  serializedVersionFields,
} from './version'
import UserModel from '../models/User'

const modelId = new ObjectId()
const anotherModelId = new ObjectId()

const testVersion: any = {
  model: modelId,
  version: '1',
  metadata: {},
  built: false,
  managerApproved: ApprovalStates.NoResponse,
  reviewerApproved: ApprovalStates.NoResponse,
  state: {},
  logs: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

const testVersion2: any = {
  model: anotherModelId,
  version: '1',
  metadata: {},
  built: true,
  managerApproved: ApprovalStates.Accepted,
  reviewerApproved: ApprovalStates.NoResponse,
  state: {},
  logs: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

const testUser = {
  userId: 'user1',
  email: 'user1@email.com',
  data: { some: 'value' },
}
const userDoc = new UserModel(testUser)

describe('test version service', () => {
  beforeEach(async () => {
    const versionDoc = await VersionModel.create(testVersion)
    await VersionModel.create(testVersion2)
    testVersion._id = versionDoc._id
  })

  test('that the serializer returns the correct properties', () => {
    // Need to improve this by testing an actual log entry to see if it has just the properties below
    const properties: any = serializedVersionFields()
    expect(properties.mandatory).toStrictEqual(['_id', 'version', 'metadata.highLevelDetails.name'])
  })

  test('find version by name/version', async () => {
    const version: any = await findVersionByName(userDoc, modelId, '1')
    expect(version).toBeTruthy()
    expect(version.version).toBe(testVersion.version)
  })

  test('find version by ID', async () => {
    const version: any = await findVersionById(userDoc, testVersion._id)
    expect(version).toBeTruthy()
    expect(version.version).toBe(testVersion.version)
  })

  test('find versions for model ID', async () => {
    const versions: any = await findModelVersions(userDoc, modelId)
    expect(versions).toBeTruthy()
    expect(versions.length).toBe(1)
  })

  test('version can be created', async () => {
    const newVersion: any = {
      version: '1',
      metadata: {},
    }
    const version: any = await createVersion(userDoc, newVersion)
    expect(version).toBeTruthy()
    expect(version.version).toBe(newVersion.version)
  })
})