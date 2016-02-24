var version = require(__dirname + '/../../../package.json').version;
var url = require('url');
var latestVersion = require('latest-version');
var os = require('os');
var _ = require('underscore');
var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var request = require('request');
var async = require('async');

module.exports = function (server) {
    server.app.use('/health', function(req, res, next) {
        var health = {
            pid: process.pid,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            status: 'ok'
        };
        var method = req.method && req.method.toLowerCase();
        if(method === 'get') {
            return help.sendBackJSON(200, res, next)(null, health);
        }

        next();
    });

    server.app.use('/status', function(req, res, next) {
        var method = req.method && req.method.toLowerCase();
        if(method === 'get') {
            var healthRoutes = config.get('health.routes');
            var healthTimeLimit = config.get('health.timeLimit');

            return latestVersion('test').then(function(result) {
                var routesCallbacks = [];
                _.each(healthRoutes, function(route) {
                    var start = new Date();
                    routesCallbacks.push(function(cb) {
                        request.get('http://' + config.get('server.host') + ':' + config.get('server.port') + route, function(err, response, body) {
                            var responseTime = (new Date() - start) / 1000;
                            var health = {
                                route: route,
                                pid: process.pid,
                                uptime: process.uptime(),
                                memory: process.memoryUsage()
                            };
                            health.responseTime = responseTime;
                            if (!err && response.statusCode == 200) {
                                if(responseTime < healthTimeLimit) {
                                    health.healthStatus = 'Green';
                                } else {
                                    health.healthStatus = 'Amber';
                                }
                            } else {
                                health.healthStatus = 'Red';
                            }
                            cb(err, health);
                        });
                    });
                });
                async.parallel(routesCallbacks, function(err, health) {
                    var data = {
                        current_version: version,
                        memory_usage: process.memoryUsage(),
                        uptime: process.uptime(),
                        load_avg: os.loadavg(),
                        latest_version: result,
                        health: health
                    };
                    help.sendBackJSON(200, res, next)(null, data);
                });
                
            });
        }

        next();
    });
};
