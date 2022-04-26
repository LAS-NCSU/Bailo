import multer from 'multer'
import config from 'config'
import { v4 as uuidv4 } from 'uuid'
import { customAlphabet } from 'nanoid'

import { validateSchema } from '../../utils/validateSchema'
import SchemaModel from '../../models/Schema'
import { normalizeMulterFile } from '../../utils/multer'
import MinioStore from '../../utils/MinioStore'
import { uploadQueue } from '../../utils/queues'
import { ensureUserRole } from '../../utils/user'
import { Request, Response } from 'express'
import mongoose from 'mongoose'

import { createVersionRequests } from '../../services/request'
import { BadReq } from '../../utils/result'
import { findModelByUuid, createModel } from '../../services/model'
import { createVersion } from '../../services/version'
import _ from 'lodash'

export interface MinioFile {
  [fieldname: string]: Array<Express.Multer.File & { bucket: string }>
}

const upload = multer({
  storage: new MinioStore({
    connection: config.get('minio'),
    bucket: () => config.get('minio.uploadBucket'),
    path: () => uuidv4(),
  }),
  limits: { fileSize: 34359738368 },
})

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6)

export const postUpload = [
  ensureUserRole('user'),
  upload.fields([{ name: 'binary' }, { name: 'code' }]),
  async (req: Request, res: Response) => {
    const session = await mongoose.startSession()
    return session.withTransaction(async () => {
      const files = req.files as unknown as MinioFile
      const mode = req.query.mode

      if (!files.binary) {
        throw BadReq({}, 'Unable to find binary file')
      }

      if (!files.code) {
        throw BadReq({}, 'Unable to find code file')
      }

      if (!files.binary[0].originalname.toLowerCase().endsWith('.zip')) {
        req.log.warn({ filename: files.binary[0].originalname }, 'Binary is not a zip file')
        return res.status(400).json({
          message: `Unable to process binary, file not a zip.`,
        })
      }

      if (!files.code[0].originalname.toLowerCase().endsWith('.zip')) {
        req.log.warn({ filename: files.code[0].originalname }, 'Code is not a zip file')
        return res.status(400).json({
          message: `Unable to process code, file not a zip.`,
        })
      }

      let metadata

      try {
        metadata = JSON.parse(req.body.metadata)
      } catch (e) {
        req.log.warn({ metadata: req.body.metadata }, 'Metadata is not valid JSON')
        return res.status(400).json({
          message: `Unable to parse schema as JSON`,
        })
      }

      const schema = await SchemaModel.findOne({
        reference: metadata.schemaRef,
      }).session(session)

      if (!schema) {
        req.log.warn({ schemaRef: metadata.schemaRef }, 'Schema not found')
        return res.status(400).json({
          message: `Unable to find schema with name: '${metadata.schemaRef}'`,
        })
      }

      metadata.timeStamp = new Date().toISOString()

      // first, we verify the schema
      const schemaIsInvalid = validateSchema(metadata, schema.schema)
      if (schemaIsInvalid) {
        req.log.warn({ errors: schemaIsInvalid }, 'Metadata did not validate correctly')
        return res.status(400).json({
          errors: schemaIsInvalid,
        })
      }

      let version
      try {
        version = await createVersion(req.user!, {
          version: metadata.highLevelDetails.modelCardVersion,
          metadata: metadata,
        }, session)
      } catch (err: any) {
        if (err.toString().includes('duplicate key error')) {
          return res.status(409).json({
            message: `Duplicate version name found for model '${req.query.modelUuid}'`,
          })
        }
      }
      req.log.info({ version }, 'Created model version')

      const name = metadata.highLevelDetails.name
        .toLowerCase()
        .replace(/[^a-z 0-9]/g, '')
        .replace(/ /g, '-')

      let parentId
      if (req.body.parent) {
        req.log.info({ parent: req.body.parent }, 'Uploaded model has parent')
        const parentModel = await findModelByUuid(req.user!, req.body.parent, session)

        if (!parentModel) {
          req.log.warn({ parent: req.body.parent }, 'Could not find parent')
          return res.status(400).json({
            message: `Unable to find parent with uuid: '${req.body.parent}'`,
          })
        }

        parentId = parentModel._id
      }

      /** Saving the model **/

      let model: any = undefined

      if (mode === 'newVersion') {
        // Update an existing model's version array
        const modelUuid = req.query.modelUuid

        model = await findModelByUuid(req.user!, modelUuid as string, session)
        model.versions.push(version._id)
        model.currentMetadata = metadata

        await model.save({ session })
      } else {
        // Save a new model, and add the uploaded version to its array
        model = await createModel(req.user!, {
          schemaRef: metadata.schemaRef,
          uuid: `${name}-${nanoid()}`,

          parent: parentId,
          versions: [version._id],
          currentMetadata: metadata,

          owner: req.user!._id,
        })
      }

      version.model = model._id
      await version.save({ session })

      req.log.info({ model }, 'Created model document')

      const [managerRequest, reviewerRequest] = await createVersionRequests({
        version: await version.populate('model'),
        session
      })
      req.log.info(
        { managerId: managerRequest._id, reviewRequest: reviewerRequest._id },
        'Successfully created requests for reviews'
      )

      const job = await uploadQueue
        .createJob({
          versionId: version._id,
          userId: req.user?._id,
          binary: normalizeMulterFile(files.binary[0]),
          code: normalizeMulterFile(files.code[0]),
        })
        .timeout(60000 * 8)
        .retries(2)
        .save()
      req.log.info({ jobId: job.id }, 'Successfully created job in upload queue')

      // then return reference to user
      res.json({
        uuid: model.uuid,
      })
    })
  },
]
