import { describe, expect, test, vi } from 'vitest'

import audit from '../../../../src/connectors/v2/audit/__mocks__/index.js'
import { getModelAccessRequestsSchema } from '../../../../src/routes/v2/model/accessRequest/getModelAccessRequests.js'
import { createFixture, testGet } from '../../../testUtils/routes.js'

vi.mock('../../../../src/utils/config.js')
vi.mock('../../../../src/utils/v2/config.js')
vi.mock('../../../../src/utils/user.js')
vi.mock('../../../../src/connectors/v2/audit/index.js')

const accessRequestMock = vi.hoisted(() => {
  return {
    getAccessRequestsByModel: vi.fn(() => undefined as any),
  }
})
vi.mock('../../../../src/services/v2/accessRequest.js', () => accessRequestMock)

describe('routes > accessRequest > getModelAccessRequests', () => {
  test('200 > ok', async () => {
    accessRequestMock.getAccessRequestsByModel.mockResolvedValueOnce({ example: 'test' })

    const fixture = createFixture(getModelAccessRequestsSchema)
    const res = await testGet(`/api/v2/model/${fixture.params.modelId}/access-requests`)

    expect(res.statusCode).toBe(200)
    expect(res.body).matchSnapshot()
  })

  test('audit > expected call', async () => {
    accessRequestMock.getAccessRequestsByModel.mockResolvedValueOnce({ example: 'test' })

    const fixture = createFixture(getModelAccessRequestsSchema)
    const res = await testGet(`/api/v2/model/${fixture.params.modelId}/access-requests`)

    expect(res.statusCode).toBe(200)
    expect(audit.onSearchAccessRequests).toBeCalled()
    expect(audit.onSearchAccessRequests.mock.calls.at(0).at(1)).toMatchSnapshot()
  })
})
