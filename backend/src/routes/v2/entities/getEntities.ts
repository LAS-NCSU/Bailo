import bodyParser from 'body-parser'
import { Request, Response } from 'express'
import { z } from 'zod'

import authentication from '../../../connectors/v2/authentication/index.js'
import { parse } from '../../../utils/validate.js'

export const getEntitiesSchema = z.object({
  query: z.object({
    q: z.string(),
  }),
})

interface GetEntitiesResponse {
  queryResults: Array<{ kind: string; entities: Array<string> }>
}

export const getEntities = [
  bodyParser.json(),
  async (req: Request, res: Response<GetEntitiesResponse>) => {
    const {
      query: { q },
    } = parse(req, getEntitiesSchema)

    const queryResults = await authentication.queryEntities(q)

    return res.json({ queryResults: queryResults })
  },
]
