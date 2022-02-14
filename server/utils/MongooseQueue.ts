import { EventEmitter } from 'events'
import { Schema, model, Model } from 'mongoose'
import { connectToMongoose, disconnectFromMongoose } from './database'

const states = [
  'Success',
  'Failed',
  'Processing',
  'Waiting'
]

const QueueSchema = new Schema({
  data: { type: Schema.Types.Mixed },
  state: { type: String, enum: states, default: 'Waiting' },
  retries: { type: Number, default: 0 }
}, {
  timestamps: true
})

interface Options {
  retries?: number
}

const defaults: Options = {
  retries: 3
}

interface Job {

}

export default class Queue extends EventEmitter {
  name: string
  opts: Options
  model: Model<any>
  handler?: Function
  interval: NodeJS.Timer
  pending: Array<Job>

  constructor(name: string, opts: Options = {}) {
    super()

    this.name = name
    this.opts = Object.assign({}, defaults, opts)
    this.model = model(name, QueueSchema)
    this.interval = setInterval(this.tick.bind(this), 500)
    this.pending = []
  }

  async createJob(data: any) {
    const job = await this.model.create({
      data, 
    })

    return job
  }

  async process(handler: Function) {
    this.handler = handler
  }

  async tick() {
    if (!this.handler) {
      return
    }

    const doc = await this.model.findOneAndUpdate(
      {
        $or: [
          { state: 'Waiting' },
          { state: 'Failed', retries: { $lt: this.opts.retries } }
        ]
      },
      {
        $set: { state: 'Processing' }
      }
    )

    if (!doc) {
      return
    }

    try {
      await this.handler(doc._id, doc.data)
      await this.model.findByIdAndRemove(doc._id)
    } catch(e) {
      doc.state = 'Failed'
      doc.retries += 1
      await doc.save()
    }
  }

  async quit() {
    clearInterval(this.interval)
  }
}

async function main() {
  await connectToMongoose()

  const queue = new Queue('test_mongoose')

  queue.process(async () => {
    console.log('hello')
    throw new Error('oh no')

    // queue.quit()
    // await disconnectFromMongoose()
  })

  queue.createJob('hello')
}

main()