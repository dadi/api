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
  var unit = ['', 'K', 'M', 'G', 'T', 'P'];

  var bytesToSize = function(input, precision)
  {
    var index = Math.floor(Math.log(input) / Math.log(1024));
    if (unit >= unit.length) return input + ' B';
    return (input / Math.pow(1024, index)).toFixed(precision) + ' ' + unit[index] + 'B';
  };

  server.app.use('/status', function(req, res, next) {
    var authorization = req.headers.authorization;
    var method = req.method && req.method.toLowerCase();
    if(method === 'get' && config.get('status.enabled')) {
      var healthRoutes = config.get('health.routes');
      var healthTimeLimit = config.get('health.timeLimit');

      return latestVersion('test').then(function(result) {
        var routesCallbacks = [];
        _.each(healthRoutes, function(route) {
          var start = new Date();
          routesCallbacks.push(function(cb) {
            request({
              url: 'http://' + config.get('server.host') + ':' + config.get('server.port') + route, 
              headers: {
                'Authorization': authorization
              }
            }, function(err, response, body) {
              var responseTime = (new Date() - start) / 1000;
              var usage = process.memoryUsage();
              var health = {
                route: route,
                pid: process.pid,
                uptime: process.uptime()+' seconds',
                memory: {
                  rss: bytesToSize(usage.rss, 3),
                  heapTotal: bytesToSize(usage.heapTotal, 3),
                  heapUsed: bytesToSize(usage.heapUsed, 3)
                }
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
          var usage = process.memoryUsage();
          var data = {
            current_version: version,
            memory_usage: {
              rss: bytesToSize(usage.rss, 3),
              heapTotal: bytesToSize(usage.heapTotal, 3),
              heapUsed: bytesToSize(usage.heapUsed, 3)
            },
            uptime: process.uptime()+' seconds',
            load_avg: os.loadavg(),
            latest_version: result,
            routes_health: health
          };
          help.sendBackJSON(200, res, next)(null, data);
        });
          
      });
    }

    next();
  });
};
