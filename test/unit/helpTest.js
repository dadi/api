var should = require('should');
var sinon = require('sinon');
var help = require(__dirname + '/../../bantam/lib/help');

describe('Help', function (done) {
    describe('parseQuery', function () {
        it('should export method', function (done) {
            help.parseQuery.should.be.Function;
            done();
        });

        it('should return correct JSON object for valid querystring', function (done) {
            var querystring = '{ "cap_id": 2337,"year":2224,"plate":4 }';
            var query = help.parseQuery(querystring);

            var k = "", v = "";
            for(var key in query) {
                if(query.hasOwnProperty(key) && key == 'plate') {
                    v = query[key];
                    k = key;
                    break;
                }
            }
        
            v.should.equal(4);

            done();
        });

        it('should return empty JSON object for invalid querystring', function (done) {
            var querystring = '{ "cap_id: 2337,"year":2224,"plate":4 }';
            var query = help.parseQuery(querystring);

            var k = "", v = "";
            for(var key in query) {
                if(query.hasOwnProperty(key)) {
                    v = query[key];
                    k = key;
                    break;
                }
            }
        
            k.should.equal("");
            v.should.equal("");

            done();
        });

        it('should return correct JSON object for querystring with leading zeroes', function (done) {
            var querystring = '{ "cap_id": 2337,"year":2224,"plate":04 }';
            var query = help.parseQuery(querystring);

            var k = "", v = "";
            for(var key in query) {
                if(query.hasOwnProperty(key) && key == 'plate') {
                    v = query[key];
                    k = key;
                    break;
                }
            }
        
            v.should.equal(4);

            done();
        });
    });
});
