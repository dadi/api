var aglio = require('aglio');
var fs = require('fs');
var _ = require('underscore');

var config = require(__dirname + '/../../../config.js');
var Blueprint = require(__dirname + '/blueprint');
var metadata = require(__dirname + '/blueprint').metadata;

var defaultOptions = {
  //"template": "default-multi"
  "themeVariables": "default",  // slate
  "themeTemplate": "default",  // triple
  "themeStyle": "default",
  "themeCondenseNav":	true,
  "themeFullWidth": false
};

module.exports = function(app, options, callback) {

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (config.has('documentation')) {
    options = config.get('documentation');
  }

  _.extend(options, defaultOptions);

  var introText = fs.readFileSync(__dirname + '/intro.md');

  var doc = "";
  doc += "FORMAT: 1A\n";

  doc += "HOST: http://" + config.get('server.host') + "\n\n";

  if (options.title) doc += "# " + options.title + "\n";
  if (options.description) doc += options.description + "\n\n";

  doc += introText + "\n\n";

  var dataStructures = "# Data Structures\n\n";
  var blueprint;

  _.each(app.components, function(route, path, list) {
    if (!route.model) {
      // blueprint = new Blueprint({model:null, path:path, route:route});
      // // Main Model Heading
      // doc += blueprint.groupName();
      // doc += blueprint.endpointMethod();
    }
    else if (route.model && route.model.name) {

      if (route.model.settings.hasOwnProperty('private') && route.model.settings.private === true) {

      }
      else {

        var bluePrintOptions = {
          apiVersion: '1.0',
          model: route.model,
          database: route.model.connection.connectionOptions.database,
          path: path,
          route: null
        };

        if (config.get('feedback')) {
          bluePrintOptions.showResponseForDeleteRequest = true;
        }

        blueprint = new Blueprint(bluePrintOptions);

        dataStructures += blueprint.dataStructure();

        // Main Model Heading
        doc += blueprint.groupName();

        doc += blueprint.collection();
        doc += blueprint.collectionList();
        doc += blueprint.post();

        // single resource requests
        doc += blueprint.resource();

        doc += blueprint.get();
        doc += blueprint.update();
        doc += blueprint.delete();
      }
    }
  });

  doc += '\n\n' + dataStructures;
  doc += '\n\n' + metadata();

  // perform indentation
  doc = doc.replace(/>/g, "    ");

  //console.log(options)

  if (options.markdown) {

    // var protagonist = require('protagonist');
    // var protagonistOptions = {
    //   generateSourceMap: false,
    //   type: 'ast'
    // };
    // var result = protagonist.parse(doc, protagonistOptions, function(err, result) {
    //   if (err) {
    //     //console.log(err);
    //     return callback(JSON.stringify(err));
    //     //return;
    //   }
    //   return callback(JSON.stringify(result));
    //   //console.log(result);
    // });


    callback(doc);

  }
  else {
    // output the rendered html blueprint
    aglio.render(doc, defaultOptions, function (err, html, warnings) {
      if (err) {
        console.log(err);
        callback(JSON.stringify(err));
      }
      else {
        //if (warnings) console.log(warnings);

        callback(html);
      }
    });
  }
}
