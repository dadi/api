var should = require('should');
var sinon = require('sinon');
var help = require(__dirname + '/../../dadi/lib/help');

describe('Help', function (done) {
    describe('validateCollectionSchema', function() {
        it('should inform of missing sections', function (done) {
            var schema = {
                    
                }
;
            var val = help.validateCollectionSchema(schema);
            val.success.should.be.false;
            val.errors.length.should.equal(2);
            val.errors[0].section.should.equal('fields');
            val.errors[0].message.should.startWith('must be provided at least once');

            done();
        });
        
        it('should inform of missing settings', function (done) {
            var schema = {
                   fields:{
                        "field1": {
                            "type": "String",
                            "label": "Title",
                            "comments": "The title of the entry",
                            "limit": "",
                            "placement": "Main content",
                            "validationRule": "",
                            "required": false,
                            "message": "",
                            "display": { 
                                "index": true,
                                "edit": true
                            }
                        }
                   },
                   settings:{cache:true} 
            };
                
            var val = help.validateCollectionSchema(schema);
            val.success.should.be.false;
            val.errors[0].setting.should.equal('authenticate');
            val.errors[0].message.should.equal('must be provided');

            done();
        });
        
        it('should inform that minimum number of fields not supplied', function (done) {
            var schema = {
                   fields:{},
                   settings:{cache:true,authenticate:true,callback:null,defaultFilters:null,fieldLimiters:null,allowExtension:true,count:10,sortOrder:1}
                }
;
            var val = help.validateCollectionSchema(schema);
            val.success.should.be.false;
            val.errors[0].section.should.equal('fields');
            val.errors[0].message.should.equal('must include at least one field');

            done();
        });

        it('should allow field collections within primary `fields` object', function (done) {
            var schema = {
            "tab1": {
                "fields": {
                    "tab1Field1": {
                        "type": "String",
                        "label": "Title",
                        "comments": "The title of the entry",
                        "limit": "",
                        "placement": "Main content",
                        "validationRule": "",
                        "required": false,
                        "message": "",
                        "display": { 
                            "index": true,
                            "edit": true
                        }
                    }
                }
            },
            "tab2": {
                "fields": {
                    "tab2Field1": {
                        "type": "String"
                    }
                }
            },
            "settings":{cache:true,authenticate:true,callback:null,defaultFilters:null,fieldLimiters:null,allowExtension:true,count:10,sortOrder:1}
            }; 

            var val = help.validateCollectionSchema(schema);
            val.success.should.be.true;

            done();
        });
    });
    
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

        it('should do nothing for querystring with leading zeroes', function (done) {
            var querystring = '{ "title": "My 007 Movie" }';
            var query = help.parseQuery(querystring);

            var k = "", v = "";
            for(var key in query) {
                if(query.hasOwnProperty(key) && key == 'title') {
                    v = query[key];
                    k = key;
                    break;
                }
            }
        
            v.should.equal("My 007 Movie");

            done();
        });

        // it('should return correct JSON object for querystring with leading zeroes', function (done) {
        //     var querystring = '{ "cap_id": 2337,"year":2224,"plate":04 }';
        //     var query = help.parseQuery(querystring);

        //     var k = "", v = "";
        //     for(var key in query) {
        //         if(query.hasOwnProperty(key) && key == 'plate') {
        //             v = query[key];
        //             k = key;
        //             break;
        //         }
        //     }
        
        //     v.should.equal(4);

        //     done();
        // });
    });
});
