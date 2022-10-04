import * as fs from 'fs'
import * as AWS from 'aws-sdk'
import path from 'path'

import config from 'config'

const s3bucket = new AWS.S3({ region: config.get('s3.region') })

export default async function uploadToS3(fileName: string): Promise<any> {
  const readStream = fs.createReadStream(fileName)

  const params = {
    Bucket: config.get('s3.bucket') as string,
    Key: `bailo/modelSource/${path.basename(fileName)}`,
    Body: readStream,
  }

  return new Promise((resolve, reject) => {
    s3bucket.upload(params, (err, data) => {
      readStream.destroy()

      if (err) {
        return reject(err)
      }

      return resolve(data)
    })
  })
}
