import { RequestHandler } from 'express'

import { ModelDoc } from '../../../models/v2/Model.js'
import { UserDoc } from '../../../models/v2/User.js'
import { Unauthorized } from '../../../utils/v2/error.js'

export const Roles = {
  Admin: 'admin',
}
export type RoleKeys = (typeof Roles)[keyof typeof Roles]

export interface UserInformation {
  name?: string
  organisation?: string
  email?: string
}

export abstract class BaseAuthenticationConnector {
  abstract hasRole(user: UserDoc, role: RoleKeys): Promise<boolean>

  abstract queryEntities(query: string): Promise<Array<{ kind: string; id: string }>>
  abstract getEntities(user: UserDoc): Promise<Array<string>>
  abstract getUserInformation(userEntity: string): Promise<UserInformation>
  abstract getEntityMembers(entity: string): Promise<Array<string>>

  async getUserInformationList(entity: string): Promise<UserInformation[]> {
    const entities = await this.getEntityMembers(entity)
    return Promise.all(entities.map((member) => this.getUserInformation(member)))
  }

  authenticationMiddleware(): Array<{ path?: string; middleware: Array<RequestHandler> }> {
    // Add Docker middleware with path that we currently use
    return [
      {
        path: '/api/v2',
        middleware: [
          function (req, res, next) {
            if (!req.user) {
              throw Unauthorized('No user')
            }
            return next()
          },
        ],
      },
    ]
  }
  async getUserModelRoles(user: UserDoc, model: ModelDoc) {
    const entities = await this.getEntities(user)

    return model.collaborators
      .filter((collaborator) => entities.includes(collaborator.entity))
      .map((collaborator) => collaborator.roles)
      .flat()
  }
}
