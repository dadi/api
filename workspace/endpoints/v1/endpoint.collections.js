var app = require(__dirname + '/../../../dadi/lib');

var _ = require('underscore');

module.exports.get = function (req, res, next) {

    var data = {};
    var collections = [];

    _.each(app.components, function (value, key) {
      if (value.hasOwnProperty("model")) {
        
        var model = value.model;
        var name = model.name;
        var slug = model.name;
        var parts = _.compact(key.split('/'));

        if (model.hasOwnProperty("settings") && model.settings.hasOwnProperty("displayName")) {
            name = model.settings.displayName;
        }

        var collection = {
            version: parts[0],
            database: parts[1],
            name: name,
            slug: slug,
            path: "/" + [parts[0], parts[1], slug].join("/")
        }

        collections.push(collection);
      }
    });

    data["collections"] = _.sortBy(collections, 'path');

    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify(data));
};
