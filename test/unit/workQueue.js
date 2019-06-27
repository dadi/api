const {WorkQueue} = require('../../dadi/lib/workQueue')
const config = require('../../config')
const configBackup = config.get()
const sinon = require('sinon')

describe('Work queue', function() {
  this.timeout(20000)

  afterEach(() => {
    config.set('workQueue.debounceTime', configBackup.workQueue.debounceTime)
    config.set('workQueue.pollingTime', configBackup.workQueue.pollingTime)
  })

  it('should start foreground jobs and wait for `workQueue.debounceTime` of idle time before starting a background job', done => {
    config.set('workQueue.debounceTime', 50)
    config.set('workQueue.pollingTime', 2)

    const stub = sinon.stub()
    const workQueue = new WorkQueue()
    const foregroundJob1 = workQueue.startForegroundJob()
    const foregroundJob2 = workQueue.startForegroundJob()

    workQueue.queueBackgroundJob(() => {
      stub('B1')

      stub.args[0].should.eql(['F1'])
      stub.args[1].should.eql(['F2'])
      stub.args[2].should.eql(['B1'])

      done()
    })

    setTimeout(() => {
      stub('F1')

      workQueue.finishForegroundJob(foregroundJob1)

      setTimeout(() => {
        stub('F2')

        workQueue.finishForegroundJob(foregroundJob2)
      }, 800)
    }, 500)
  })

  it('should start foreground jobs with `wrapForegroundJob`', done => {
    config.set('workQueue.debounceTime', 50)
    config.set('workQueue.pollingTime', 2)

    const stub = sinon.stub()
    const workQueue = new WorkQueue()
    const foregroundJob1 = workQueue.wrapForegroundJob(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          stub('F1')

          resolve()
        }, 500)
      })
    })
    const foregroundJob2 = workQueue.wrapForegroundJob(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          stub('F2')

          resolve()
        }, 1000)
      })
    })

    workQueue.queueBackgroundJob(() => {
      stub('B1')

      stub.args[0].should.eql(['F1'])
      stub.args[1].should.eql(['F2'])
      stub.args[2].should.eql(['B1'])

      done()
    })

    foregroundJob1()
    foregroundJob2()
  })

  it('should prioritise new foreground jobs over existing background jobs', done => {
    /*
      
      |  F1  |  F2  |  B1  |  B2  |
                          ^
                          F3
    */
    config.set('workQueue.debounceTime', 500)
    config.set('workQueue.pollingTime', 10)

    const stub = sinon.stub()
    const workQueue = new WorkQueue()
    const foregroundJob1 = workQueue.startForegroundJob()
    const foregroundJob2 = workQueue.startForegroundJob()

    workQueue.queueBackgroundJob(() => {
      stub('B1')
    })

    workQueue.queueBackgroundJob(() => {
      stub('B2')

      stub.args[0].should.eql(['F1'])
      stub.args[1].should.eql(['F2'])
      stub.args[2].should.eql(['B1'])
      stub.args[3].should.eql(['F3'])
      stub.args[4].should.eql(['B2'])

      done()
    })

    setTimeout(() => {
      stub('F1')

      workQueue.finishForegroundJob(foregroundJob1)

      setTimeout(() => {
        stub('F2')

        workQueue.finishForegroundJob(foregroundJob2)
      }, 300)
    }, 300)

    setTimeout(() => {
      const foregroundJob3 = workQueue.startForegroundJob()

      setTimeout(() => {
        stub('F3')

        workQueue.finishForegroundJob(foregroundJob3)
      }, 1)
    }, 1300)
  })
})
