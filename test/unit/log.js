var fs = require('fs');
var path = require('path');
var should = require('should');
var sinon = require('sinon');

var config = require(__dirname + '/../../config');
var log = require(__dirname + '/../../dadi/lib/log');
var logConfig = config.get('logging');
var accessLogPath = path.resolve(logConfig.path + '/' + logConfig.filename + '.access.' + logConfig.extension);

var resetLog = function (done) {
    var logpath = logConfig.path + '/' + logConfig.filename  + '.test.' + logConfig.extension;
    logpath.should.be.String;

    // empty the log for each test
    fs.writeFileSync(logpath, new Buffer(''))
    done();
};

describe('logger', function () {

    describe('access log', function () {

      it('should export a `getAccessLog()` function', function (done) {
        log.getAccessLog.should.be.Function;
        done();
      });

      it('should export an `access()` function', function (done) {
        log.access.should.be.Function;
        done();
      });

      it('should be an instance of "object"', function (done) {
        (log.getAccessLog() instanceof Object).should.eql(true);
        done();
      });

      it('should log to the access log if enabled', function (done) {
        var logMessage = 'log to fs';
        log.access(logMessage);

        var logpath = path.resolve(config.get('logging').path + '/' + config.get('logging').filename + '.access.' + config.get('logging').extension);
        logpath.should.be.String;

        var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'});
        logEntry.indexOf('log to fs').should.be.above(0);
        done();
      });
    });

    describe('log', function () {
        var _log = log.get();

        beforeEach(resetLog);

        it('should export a `debug()` function', function (done) {
          log.debug.should.be.Function;
          done();
        });

        it('should export a `stage()` function', function (done) {
          log.stage.should.be.Function;
          done();
        });

        it('should export a `prod()` function', function (done) {
          log.prod.should.be.Function;
          done();
        });

        it('should use bunyan log.warn when log.stage is called', function (done) {

          var message = 'Hello';

          var logger = log.get();
          var method = sinon.spy(logger, 'warn');

          log.stage(message);
          logger.warn.restore();

          method.called.should.eql(true);

          done();
        });

        it('should use bunyan log.warn when log.stage is called', function (done) {

          var message = 'Hello';

          var logger = log.get();
          var method = sinon.spy(logger, 'warn');

          log.stage(message);
          logger.warn.restore();

          method.called.should.eql(true);

          done();
        });

        it('should use bunyan log.warn when log.prod is called', function (done) {

          var message = 'Hello';

          var logger = log.get();
          var method = sinon.spy(logger, 'warn');

          log.prod(message);
          logger.warn.restore();

          method.called.should.eql(true);

          done();
        });

        it('should use bunyan log.debug when log.debug is called', function (done) {
          var message = 'Hello';
          var logger = log.get();
          var method = sinon.spy(logger, 'debug');
          log.debug(message);
          logger.debug.restore();
          method.called.should.eql(true);
          done();
        });

        it('should use bunyan log.info when log.info is called', function (done) {
          var message = 'Hello';
          var logger = log.get();
          var method = sinon.spy(logger, 'info');
          log.info(message);
          logger.info.restore();
          method.called.should.eql(true);
          done();
        });

        it('should use bunyan log.error when log.error is called', function (done) {
          var message = 'Hello';
          var logger = log.get();
          var method = sinon.spy(logger, 'error');
          log.error(message);
          logger.error.restore();
          method.called.should.eql(true);
          done();
        });

        it('should use bunyan log.trace when log.trace is called', function (done) {
          var message = 'Hello';
          var logger = log.get();
          var method = sinon.spy(logger, 'trace');
          log.trace(message);
          logger.trace.restore();
          method.called.should.eql(true);
          done();
        });

        it('should log string arg to filesystem', function (done) {
            var logMessage = 'log to fs';
            _log.info(logMessage);

            var logpath = path.resolve(config.get('logging').path + '/' + config.get('logging').filename + '.test.' + config.get('logging').extension);
            logpath.should.be.String;

            var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'});
            logEntry.indexOf('log to fs').should.be.above(0);
            done();
        });

        it('should *append* to log file', function (done) {
            _log.info('line 1');
            _log.info('line 2');
            setTimeout(function () {
                var logpath = config.get('logging').path + '/' + config.get('logging').filename + '.test.' + config.get('logging').extension;
                var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'});
                var line1 = logEntry.indexOf('line 1');
                var line2 = logEntry.indexOf('line 2');
                line1.should.be.above(0);
                line2.should.be.above(0);
                done();
            }, 300);
        });
    });

    // describe('format', function () {
    //     var format = logger.format;
    //
    //     beforeEach(resetLog);
    //
    //     it('should accept json', function (done) {
    //         format({message: 'test message'});
    //         done();
    //     });
    //
    //     it('should return string', function (done) {
    //         var m = 'test message 2';
    //         var message = format({message: m});
    //
    //         message.split(' - ').length.should.equal(3);
    //         message.split(' - ')[2].should.equal(m + '\n');
    //         done();
    //     });
    // });
});
