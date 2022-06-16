import { Request, Response } from 'express'
import { getModelDeleteQueue } from 'server/utils/queues'
import bodyParser from 'body-parser'
import { ensureUserRole } from '../../utils/user'
import { createVersionRequests } from '../../services/request'
import { Forbidden, NotFound, BadReq } from '../../utils/result'
import { findVersionById } from '../../services/version'
import { ApprovalStates } from '../../models/Deployment'

export const getVersion = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    const { id } = req.params

    const version = await findVersionById(req.user!, id)

    if (!version) {
      throw NotFound({ code: 'version_not_found', versionId: id }, 'Unable to find version')
    }

    req.log.info({ code: 'fetching_version', version }, 'User fetching version')
    return res.json(version)
  },
]

export const putVersion = [
  ensureUserRole('user'),
  bodyParser.json(),
  bodyParser.urlencoded({ extended: true }),
  async (req: Request, res: Response) => {
    const { id } = req.params
    const metadata = req.body

    const version = await findVersionById(req.user!, id, { populate: true })

    if (!version) {
      throw NotFound({ code: 'version_not_found', id: id }, 'Unable to find version')
    }

    if (req.user?.id !== version.metadata.contacts.uploader) {
      throw Forbidden({ code: 'user_unauthorised' }, 'User is not authorised to do this operation.')
    }

    version.metadata = metadata
    version.managerApproved = ApprovalStates.NoResponse
    version.reviewerApproved = ApprovalStates.NoResponse

    await version.save()
    await createVersionRequests({ version })

    req.log.info({ code: 'updating_version', version }, 'User updating version')
    return res.json(version)
  },
]

export const resetVersionApprovals = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    const { id } = req.params
    const user = req.user

    const version = await findVersionById(req.user!, id, { populate: true })
    if (!version) {
      throw BadReq({ code: 'version_not_found' }, 'Unabled to find version for requested deployment')
    }
    if (user?.id !== version.metadata.contacts.uploader) {
      throw Forbidden({ code: 'user_unauthorised' }, 'User is not authorised to do this operation.')
    }
    version.managerApproved = ApprovalStates.NoResponse
    version.reviewerApproved = ApprovalStates.NoResponse
    await version.save()
    await createVersionRequests({ version })

    req.log.info({ code: 'version_approvals_reset', version }, 'User reset version approvals')
    return res.json(version)
  },
]

export const retireVersion = [
  ensureUserRole('user'),
  async (req: Request, res: Response) => {
    const {
      params: { id },
      user,
    } = req

    const version = await findVersionById(user, id, { populate: true })
    if (!version) {
      throw BadReq({ code: 'version_not_found' }, 'Unabled to find version for requested deployment')
    }
    if (user?.id !== version.metadata.contacts.uploader) {
      throw Forbidden({ code: 'user_unauthorised' }, 'User is not authorised to do this operation.')
    }

    req.log.info(
      {
        code: 'delete_model_version_by_uuid',
        version: version._id,
      },
      'Deleting version by a given UUID'
    )
    const jobId = await (
      await getModelDeleteQueue()
    ).add({
      userId: user._id,
      versionId: version._id,
    })

    req.log.info(
      { code: 'created_delete_version_job', jobId },
      'Successfully created job in delete model version queue'
    )

    return res.json(version)
  },
]
