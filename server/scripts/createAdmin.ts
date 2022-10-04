/* eslint-disable import/newline-after-import */
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { connectToMongoose, disconnectFromMongoose } from '../utils/database'
import UserModel from '../models/User'
import logger from '../utils/logger'
;(async () => {
  await connectToMongoose()

  const argv = await yargs(hideBin(process.argv)).usage('User name: $0 [uuid]').argv

  const uuid = argv._
  const user = await UserModel.findOne({
    id: uuid,
  })

  if (!user) {
    throw new Error('Unable to find user')
  }

  await Promise.all([UserModel.updateOne({ id: user.id }, { $set: { roles: ['user', 'admin'] } })])

  logger.info('Updater user admin role')

  setTimeout(async () => {
    disconnectFromMongoose()
    process.exit(0)
  }, 50)
})()
