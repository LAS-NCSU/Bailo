/* eslint-disable import/newline-after-import */
import { createSchema } from '../services/schema'
import { connectToMongoose, disconnectFromMongoose } from '../utils/database'

import minimal from './example_schemas/las_scads_upload_schema.json'
;(async () => {
  await connectToMongoose()

  await createSchema(
    {
      name: 'LAS SCADS Upload Schema v1',
      reference: '/LAS/SCADS/v1',
      schema: minimal,
      use: 'UPLOAD',
    },
    true
  )

  setTimeout(disconnectFromMongoose, 50)
})()
