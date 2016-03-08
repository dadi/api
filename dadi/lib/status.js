var async = require('async');
var latestVersion = require('latest-version');
var os = require('os');
var request = require('request');
var url = require('url');
var _ = require('underscore');
var pkgName = require(__dirname + '/../../package.json').name;
var version = require(__dirname + '/../../package.json').version;

var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');

function secondsToString(seconds) {
  var numdays = Math.floor(seconds / 86400);
  var numhours = Math.floor((seconds % 86400) / 3600);
  var numminutes = Math.floor(((seconds % 86400) % 3600) / 60);
  var numseconds = Math.floor(((seconds % 86400) % 3600) % 60);
  return numdays + " days " + numhours + " hours " + numminutes + " minutes " + numseconds + " seconds";
}

function bytesToSize(input, precision) {
  var unit = ['', 'K', 'M', 'G', 'T', 'P'];
  var index = Math.floor(Math.log(input) / Math.log(1024));

  if (unit >= unit.length) return input + ' B';
  return (input / Math.pow(1024, index)).toFixed(precision) + ' ' + unit[index] + 'B';
};

module.exports = function (server) {
  server.app.use('/api/status', function(req, res, next) {
    var authorization = req.headers.authorization;
    var method = req.method && req.method.toLowerCase();

    if (method === 'get' && config.get('status.enabled')) {
      var healthRoutes = config.get('status.routes');

      return latestVersion(pkgName).then(function(latestVersion) {
        var routesCallbacks = [];
        _.each(healthRoutes, function(route) {
          var start = new Date();
          routesCallbacks.push(function(cb) {
            request({
              url: 'http://' + config.get('server.host') + ':' + config.get('server.port') + route.route,
              headers: {
                'Authorization': authorization
              }
            }, function(err, response, body) {
              var responseTime = (new Date() - start) / 1000;
              var usage = process.memoryUsage();
              var health = {
                route: route.route,
                responseTime: responseTime
              }

              if (!err && response.statusCode == 200) {
                if (responseTime < route.expectedResponseTime) {
                  health.health = 'Green';
                } else {
                  health.health = 'Amber';
                }
              } else {
                health.health = 'Red';
              }

              cb(err, health);
            });
          });
        });
        async.parallel(routesCallbacks, function(err, health) {
          var usage = process.memoryUsage();
          var data = {
            service: {
              name: pkgName,
              versions: {
                current: version,
                latest: latestVersion
              }
            },
            process: {
              pid: process.pid,
              uptime: process.uptime(),
              uptimeFormatted: secondsToString(process.uptime()),
              versions: process.versions
            },
            memory: {
              rss: bytesToSize(usage.rss, 3),
              heapTotal: bytesToSize(usage.heapTotal, 3),
              heapUsed: bytesToSize(usage.heapUsed, 3)
            },
            system: {
              platform: os.platform(),
              release: os.release(),
              hostname: os.hostname(),
              memory: {
                free: bytesToSize(os.freemem(), 3),
                total: bytesToSize(os.totalmem(), 3)
              },
              load: os.loadavg(),
              uptime: os.uptime(),
              uptimeFormatted: secondsToString(os.uptime())
            },
            routes: health
          };
          help.sendBackJSON(200, res, next)(null, data);
        });

      });
    }

    next();
  });
};
