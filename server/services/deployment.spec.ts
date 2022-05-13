import jest from 'jest'
import { createSerializer, SerializerOptions } from '../utils/logger'
import sinon from 'sinon'
import UserModel from '../models/User';
import { findDeploymentByUuid } from './deployment'

const serializer = [
  {
    _id: '627e69a471c9bf5ed22dd1e1',
    reference: '/Minimal/Deployment/v6',
    name: 'Minimal Deployment Schema v6',
    use: 'DEPLOYMENT'
  }
]

describe("Deployment services tests", () => {
  const deploymentService = require('./deployment')
  beforeEach(() => {
    sinon.stub(deploymentService, 'serializedDeploymentFields').callsFake(() => {
      return serializer
    })
  });
  afterAll(() => {
    deploymentService.serializedDeploymentFields.restore()
  });
  it("should be able to fetch a deployment using a given UUID", () => {
    const deployment = findDeploymentByUuid(new UserModel, "test123");
    expect(deployment).toBe(undefined)
  });
});