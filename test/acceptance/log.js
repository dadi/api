var config = require(__dirname + '/../../config');
var logger = require(__dirname + '/../../bantam/lib/log');
var fs = require('fs');
var should = require('should');

var resetLog = function (done) {
    var logpath = config.get('logging').path + '/' + config.get('logging').filename + '.' + config.get('logging').extension;
    logpath.should.be.String;

    // empty the log for each test
    fs.writeFileSync(logpath, new Buffer(''))
    done();
};

describe('logger', function () {
    beforeEach(resetLog);

    describe('.prod', function () {
        it('should log each message on new line', function (done) {
            logger.prod('test1');
            logger.prod('test2');
            setTimeout(function () {
                var logpath = config.get('logging').path + '/' + config.get('logging').filename + '.' + config.get('logging').extension;
                var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'});

                logEntry.split('\n').length.should.equal(3);
                logEntry.split('\n')[2].length.should.equal(0);
                done();
            }, 300);
        });
    });

    describe('.stage', function () {
        it('should log each message on new line', function (done) {
            logger.stage('test1');
            logger.stage('test2');
            setTimeout(function () {
                var logpath = config.get('logging').path + '/' + config.get('logging').filename + '.' + config.get('logging').extension;
                var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'});

                logEntry.split('\n').length.should.equal(3);
                logEntry.split('\n')[2].length.should.equal(0);
                done();
            }, 300);
        });
    });

    describe('.debug', function () {
        it('should log each message on new line', function (done) {
            logger.debug('test1');
            logger.debug('test2');
            setTimeout(function () {
                var logpath = config.get('logging').path + '/' + config.get('logging').filename + '.' + config.get('logging').extension;
                var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'});

                logEntry.split('\n').length.should.equal(3);
                logEntry.split('\n')[2].length.should.equal(0);
                done();
            }, 300);
        });
    });
});
