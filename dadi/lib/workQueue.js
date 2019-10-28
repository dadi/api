const config = require('../../config')

class WorkQueue {
  constructor() {
    this.debounceTime = config.get('workQueue.debounceTime')
    this.pollingTime = config.get('workQueue.pollingTime')

    this.backgroundPool = []
    this.foregroundPool = new Map()

    this.startBackgroundQueue()
  }

  clearDebounceTimer() {
    clearInterval(this.debounceTimer)

    this.debounceTimer = undefined
  }

  dequeueBackgroundJob() {
    if (this.debounceTimer) {
      return
    }

    this.debounceTimer = setTimeout(() => {
      const job = this.backgroundPool.shift()

      if (typeof job === 'function') {
        job.call(this)
      }

      this.clearDebounceTimer()
    }, this.debounceTime)
  }

  finishForegroundJob(key) {
    return this.foregroundPool.delete(key)
  }

  queueBackgroundJob(callback) {
    this.backgroundPool.push(callback)
  }

  startBackgroundQueue() {
    this.pollingTimer = setInterval(() => {
      if (this.foregroundPool.size > 0) {
        return
      }

      this.dequeueBackgroundJob()
    }, this.pollingTime)
  }

  startForegroundJob() {
    const key = process.hrtime().join('.')

    this.clearDebounceTimer()

    this.foregroundPool.set(key, true)

    return key
  }

  wrapForegroundJob(wrappedFunction) {
    const context = this

    return function() {
      const jobId = context.startForegroundJob()

      return Promise.resolve(wrappedFunction.apply(this, arguments))
        .then(result => {
          context.finishForegroundJob(jobId)

          return result
        })
        .catch(error => {
          context.finishForegroundJob(jobId)

          return Promise.reject(error)
        })
    }
  }
}

module.exports = new WorkQueue()
module.exports.WorkQueue = WorkQueue
