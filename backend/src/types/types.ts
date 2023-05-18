import { Document, Types } from 'mongoose'

export enum ModelUploadType {
  Zip = 'Code and binaries',
  ModelCard = 'Model card only',
  Docker = 'Prebuilt Docker image',
}

export enum UploadModes {
  NewModel = 'newModel',
  NewVersion = 'newVersion',
}

export enum ApprovalStates {
  Accepted = 'Accepted',
  Declined = 'Declined',
  NoResponse = 'No Response',
}

export enum ApprovalCategory {
  Upload = 'Upload',
  Deployment = 'Deployment',
}

export interface DeploymentMetadata {
  highLevelDetails: {
    name: string
    [x: string]: unknown
  }

  contacts: {
    owner: Array<Entity>
    [x: string]: unknown
  }
}

export interface ModelMetadata {
  highLevelDetails: {
    tags: Array<string>
    name: string
    modelInASentence: string
    modelOverview: string
    modelCardVersion: string
    [x: string]: any
  }

  contacts: {
    uploader: Array<Entity>
    reviewer: Array<Entity>
    manager: Array<Entity>
    [x: string]: any
  }

  buildOptions?: {
    uploadType: ModelUploadType
    seldonVersion: string
    [x: string]: any
  }

  // allow other properties
  [x: string]: any
}

export interface LogStatement {
  timestamp: Date
  level: string
  msg: string
}

export type ModelId = string | Types.ObjectId

export enum SchemaType {
  UPLOAD = 'UPLOAD',
  DEPLOYMENT = 'DEPLOYMENT',
}

export interface Schema {
  name: string
  reference: string
  schema: any
  use: SchemaType
}

// Dates are in ISO 8601 format
enum DateStringBrand {}
export type DateString = string & DateStringBrand

export enum EntityKind {
  USER = 'user',
}

export interface Entity {
  kind: EntityKind
  id: string
}

export interface ParsedEntity {
  kind: EntityKind
  entity: UserDoc
}

export interface StatusError extends Error {
  data: any
  code: number
}

export interface UiConfig {
  banner: {
    enabled: boolean
    text: string
    colour: string
  }

  issues: {
    label: string
    supportHref: string
    contactHref: string
  }

  registry: {
    host: string
  }

  uploadWarning: {
    showWarning: boolean
    checkboxText: string
  }

  deploymentWarning: {
    showWarning: boolean
    checkboxText: string
  }

  development: {
    logUrl: string
  }

  seldonVersions: Array<SeldonVersion>
}

export type SeldonVersion = {
  name: string
  image: string
}

export type DocHeading = {
  title: string
  slug: string
  hasIndex: boolean
  children: DocFileOrHeading[]
  priority: number
}

export type DocFile = {
  title: string
  slug: string
  priority: number
}

export type DocFileOrHeading = DocHeading | DocFile

export type DocsMenuContent = DocFileOrHeading[]

export enum LogLevel {
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60,
}

export enum LogLevelLabel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export enum LogType {
  Build = 'build',
  Approval = 'approval',
  Misc = 'misc',
}

export interface LogEntry {
  _id: string
  name: string
  hostname: string
  pid: number

  level: LogLevel

  msg: string

  time: string

  src?: {
    file: string
    line: number
  }

  [x: string]: unknown
}

export type SchemaQuestion = {
  reference: string
  title: string
  description: string
  type: string
  format?: string
  minLength?: number
  maxLength?: number
  widget?: string
  readOnly?: boolean
}

export interface MinimalEntry {
  compressedSize: number
  generalPurposeBitFlag: number
  compressionMethod: number
  relativeOffsetOfLocalHeader: number
  uncompressedSize: number
  fileName: string
}

export enum ApprovalTypes {
  Manager = 'Manager',
  Reviewer = 'Reviewer',
}

export interface Approval {
  _id: any
  version: Types.ObjectId | VersionDoc | undefined
  deployment: Types.ObjectId | DeploymentDoc | undefined

  approvers: Array<Entity>
  status: ApprovalStates

  approvalType: ApprovalTypes
  approvalCategory: ApprovalCategory

  createdAt: Date
  updatedAt: Date
}

export type ApprovalDoc = Approval & Document<any, any, Approval>

export interface Deployment {
  _id: any
  schemaRef: string | null
  uuid: string

  model: Types.ObjectId | ModelDoc
  metadata: DeploymentMetadata

  managerApproved: ApprovalStates

  logs: Types.Array<LogStatement>
  built: boolean
  ungoverned: boolean

  createdAt: Date
  updatedAt: Date

  log: (level: string, msg: string) => Promise<void>
}

export type DeploymentDoc = Deployment & Document<any, any, Deployment>

export interface Model {
  _id: any
  schemaRef: string
  uuid: string

  versions: Types.Array<VersionDoc | Types.ObjectId>
  latestVersion: VersionDoc | Types.ObjectId

  createdAt: Date
  updatedAt: Date
}

export type ModelDoc = Model & Document<any, any, Model>

export interface User {
  _id: any
  id: string
  email: string

  roles: Types.Array<string>
  favourites: Types.Array<ModelDoc | Types.ObjectId>

  token?: string | undefined
  data?: any

  createdAt: Date
  updatedAt: Date

  compareToken: (candidateToken: string) => Promise<boolean>
}

export type UserDoc = User & Document<any, any, User>

export interface Version {
  _id: any
  model: ModelDoc | Types.ObjectId
  version: string

  metadata: ModelMetadata

  built: boolean
  managerApproved: ApprovalStates
  reviewerApproved: ApprovalStates

  managerLastViewed: DateString
  reviewerLastViewed: DateString

  files: {
    rawBinaryPath?: string
    binary?: {
      fileList?: Array<MinimalEntry>
    }

    rawCodePath?: string
    code?: {
      fileList?: Array<MinimalEntry>
    }

    rawDockerPath?: string
  }

  state: any
  logs: Types.Array<LogStatement>

  createdAt: Date
  updatedAt: Date

  log: (level: string, msg: string) => Promise<void>
}

export type VersionDoc = Version & Document<any, any, Version>
