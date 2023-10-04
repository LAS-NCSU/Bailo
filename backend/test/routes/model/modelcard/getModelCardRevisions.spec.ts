import { describe, expect, test, vi } from 'vitest'

import { getModelCardRevisionsSchema } from '../../../../src/routes/v2/model/modelcard/getModelCardRevisions.js'
import { createFixture, testGet } from '../../../testUtils/routes.js'

vi.mock('../../../../src/utils/config.js')
vi.mock('../../../../src/utils/user.js')

const modelMock = vi.hoisted(() => {
  return {
    getModelCards: vi.fn(() => undefined as any),
  }
})
vi.mock('../../../../src/services/v2/model.js', () => modelMock)

describe('routes > model > getModel', () => {
  test('latest > 200 > ok', async () => {
    modelMock.getModelCards.mockResolvedValueOnce({ example: 'test' })

    const fixture = createFixture(getModelCardRevisionsSchema)
    const res = await testGet(`/api/v2/model/${fixture.params.modelId}/model-card`)

    expect(res.statusCode).toBe(200)
    expect(res.body).matchSnapshot()
  })

  test('version > 200 > ok', async () => {
    modelMock.getModelCards.mockResolvedValueOnce({ _id: 'test' })

    const fixture = createFixture(getModelCardRevisionsSchema)
    const res = await testGet(`/api/v2/model/${fixture.params.modelId}/model-card/100`)

    expect(res.statusCode).toBe(200)
    expect(res.body).matchSnapshot()
  })
})
