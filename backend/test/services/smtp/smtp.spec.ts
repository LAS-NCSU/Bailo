import { describe, expect, test, vi } from 'vitest'

import Release from '../../../src/models/v2/Release.js'
import ReviewRequest from '../../../src/models/v2/ReviewRequest.js'
import config from '../../../src/utils/v2/config.js'
import { EntityKind, fromEntity } from '../../../src/utils/v2/entity.js'
import { requestReviewForRelease } from '../../../src/services/v2/smtp/smtp.js'

vi.mock('../../../src/utils/v2/config.js', () => {
  return {
    __esModule: true,
    default: {
      app: {
        protocol: '',
        host: '',
        port: 3000,
      },

      smtp: {
        enabled: true,

        connection: {
          host: 'localhost',
          port: 1025,
          secure: false,
          auth: undefined,
          tls: {
            rejectUnauthorized: false,
          },
        },

        from: '"Bailo 📝" <bailo@example.org>',
      },
    },
  }
})

vi.mock('../../../src/services/v2/log.js', async () => ({
  default: {
    info: vi.fn(),
  },
}))

const transporterMock = vi.hoisted(() => {
  return {
    sendMail: vi.fn(() => ({ messageId: 123 })),
  }
})
const nodemailerMock = vi.hoisted(() => ({
  createTransport: vi.fn(() => transporterMock),
}))
vi.mock('nodemailer', async () => ({
  default: nodemailerMock,
}))

const authorisationMock = vi.hoisted(() => ({
  getUserInformation: vi.fn(() => ({ email: 'email@email.com' })),
  getGroupMembers: vi.fn(),
}))
vi.mock('../../../src/connectors/v2/authorisation/index.js', async () => ({ default: authorisationMock }))

const releaseEmailMock = vi.hoisted(() => {
  const obj: any = {
    to: "email@email.com",
    subject: "subject",
    text: "text",
    html: "html"
  }

  obj.setSubject = vi.fn()
  obj.setTo = vi.fn()
  obj.setText = vi.fn()
  obj.setHtml = vi.fn()

  const model: any = vi.fn(() => obj)
  Object.assign(model, obj)

  return model
})
vi.mock('../../../src/services/v2/smtp/templates/releaseReviewRequest.js', () => ({
  ReleaseReviewRequestEmail: releaseEmailMock,
}))

const entityUtilsMock = vi.hoisted(async () => ({
  ...((await vi.importActual('../../../src/utils/v2/entity.js')) as object),
  fromEntity: vi.fn(() => ({
    kind: 'user',
    value: 'user',
  })),
}))
vi.mock('../../../src/utils/v2/entity.js', () => entityUtilsMock)

describe('services > smtp', () => {
  test('that an email is sent', async () => {
    await requestReviewForRelease('user:user', new ReviewRequest(), new Release())

    expect(transporterMock.sendMail.mock.calls.at(0)).toMatchSnapshot()
  })

  test('that an email is not sent when disabled in config', async () => {
    vi.spyOn(config, 'smtp', 'get').mockReturnValueOnce({
      enabled: false,
      connection: {
        host: 'localhost',
        port: 1025,
        secure: false,
        auth: { user: '', pass: '' },
        tls: {
          rejectUnauthorized: false,
        },
      },
      from: '"Bailo 📝" <bailo@example.org>',
    })

    await requestReviewForRelease('user:user', new ReviewRequest(), new Release())

    expect(transporterMock.sendMail).not.toBeCalled()
  })

  test('that an error is thrown when an email cannot be sent', async () => {
    transporterMock.sendMail.mockRejectedValueOnce('Failed to send email')

    const result: Promise<void> = requestReviewForRelease('user:user', new ReviewRequest(), new Release())
    expect(result).rejects.toThrowError(`Error Sending email notification`)
  })

  test('that an error is thrown when an unknown entity is provided', async () => {
    (await entityUtilsMock).fromEntity.mockReturnValueOnce({ kind: 'fake', value: 'fake' })

    const result: Promise<void> = requestReviewForRelease('user:user', new ReviewRequest(), new Release())
    expect(result).rejects.toThrowError(`Error Sending email notification to unrecognised entity`)
  })

  test('that sendEmail is called for each member of a group entity', async () => {
    (await entityUtilsMock).fromEntity.mockReturnValueOnce({ kind: EntityKind.Group, value: 'groupName' })
    const groupMembers: string[] = ['user:groupMember1', 'user:groupMember2']
    authorisationMock.getGroupMembers.mockReturnValueOnce(groupMembers)

    await requestReviewForRelease('group:group1', new ReviewRequest(), new Release())

    expect(authorisationMock.getUserInformation.mock.calls).toMatchSnapshot()
  })
})
