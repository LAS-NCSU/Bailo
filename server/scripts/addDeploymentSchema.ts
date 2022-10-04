/* eslint-disable import/newline-after-import */
import { createSchema } from '../services/schema'
import { connectToMongoose, disconnectFromMongoose } from '../utils/database'
import minimal from './example_schemas/las_scads_deployment_schema.json'
;(async () => {
  await connectToMongoose()

  await createSchema({
    name: 'LAS SCADS Deployment Schema v1',
    reference: '/LAS/SCADS/Deployment/v1',
    schema: minimal,
    use: 'DEPLOYMENT',
  })

  setTimeout(disconnectFromMongoose, 50)
})()