var config = require(__dirname + '/../../config');
var logger = require(__dirname + '/../../dadi/lib/log');
var fs = require('fs');
var should = require('should');

var resetLog = function (done) {
    var logpath = config.get('logging').path + '/' + config.get('logging').filename  + '.' + config.get('logging').extension;
    logpath.should.be.String;

    // empty the log for each test
    fs.writeFileSync(logpath, new Buffer(''))
    done();
};

describe('dadi logger', function () {
    describe('_log', function () {
        var _log = logger._log;

        beforeEach(resetLog);

        it('should log string arg to filesystem', function (done) {
            var logMessage = 'log to fs';
            _log(logMessage, function (err) {
                if (err) return done(err);

                var logpath = config.get('logging').path + '/' + config.get('logging').filename + '.' + config.get('logging').extension;
                logpath.should.be.String;

                var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'}).should.equal(logMessage);
                done();
            });
        });

        it('should log without a callback', function (done) {
            var logMessage = 'no callback';
            _log(logMessage);
            setTimeout(function () {
                var logpath = config.get('logging').path + '/' + config.get('logging').filename + '.' + config.get('logging').extension;
                logpath.should.be.String;

                var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'}).should.equal(logMessage);
                done();
            }, 500);
        });

        it('should *append* to log file', function (done) {
            _log('line 1\n');
            _log('line 2\n');
            setTimeout(function () {
                var logpath = config.get('logging').path + '/' + config.get('logging').filename + '.' + config.get('logging').extension;
                var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'});
                logEntry.should.equal('line 1\nline 2\n');
                done();
            }, 300);
        });
    });

    describe('format', function () {
        var format = logger.format;

        beforeEach(resetLog);

        it('should accept json', function (done) {
            format({message: 'test message'});
            done();
        });

        it('should return string', function (done) {
            var m = 'test message 2';
            var message = format({message: m});

            message.split(' - ').length.should.equal(3);
            message.split(' - ')[2].should.equal(m + '\n');
            done();
        });
    });

    describe('levels', function () {
        beforeEach(resetLog);

        it('should expose `debug` method', function (done) {
            logger.debug.should.be.Function;
            done();
        });

        it('should log to fs when `debug` is called', function (done) {
            logger.debug('log to fs', function (err) {
                if (err) return done(err);

                var logpath = config.get('logging').path + '/' + config.get('logging').filename + '.' + config.get('logging').extension;
                logpath.should.be.String;
                console.log(logpath)
                var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'});
                console.log(logEntry)
                logEntry.should.match(/log to fs/);
                done();
            });
        });

        it('should expose `stage` method', function (done) {
            logger.stage.should.be.Function;
            done();
        });

        it('should expose `prod` method', function (done) {
            logger.prod.should.be.Function;
            done();
        });
    });
});
