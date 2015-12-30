var aglio = require('aglio');
var fs = require('fs');
var _ = require('underscore');

var config = require(__dirname + '/../../../config.js');
var Blueprint = require(__dirname + '/blueprint');

var defaultOptions = {
  "template": "default-multi"
};

module.exports = function(app, callback) {

  var options = {};

  if (config.has('documentation')) {
    options = config.get('documentation');
  }

  _.extend(options, defaultOptions);

  var introText = fs.readFileSync(__dirname + '/intro.md');

  var doc = "";
  doc += "FORMAT: 1A\n";

  doc += "HOST: " + config.get('server.host') + "\n\n";
  if (options.title) doc += "# " + options.title + "\n";
  if (options.description) doc += options.description + "\n\n";

  doc += introText + "\n\n";

  _.each(app.components, function(route, path, list) {

    if (route.model && route.model.name) {

      //console.log(route.model.settings)
      if (route.model.settings.hasOwnProperty('internal') && route.model.settings.internal === true) {

      }
      else {

        var blueprint = new Blueprint(route.model, path);

        // Main Model Heading
        doc += blueprint.groupName();

        // Get single
        doc += blueprint.getMethod();

        // Edit
        doc += blueprint.updateMethod();

        // Delete
        doc += blueprint.deleteMethod();


        // Model List
        doc += blueprint.modelListGroup();

        // Get all
        doc += blueprint.modelListMethod();


        // POST 'create'
        doc += blueprint.createMethod();

        // perform indentation
        doc = doc.replace(/>/g, "    ");
      }
    }
  });

  if (options && options.markdown) {
    callback(doc);
  }
  else {
    // output the rendered html blueprint
    aglio.render(doc, defaultOptions.template, function (err, html, warnings) {
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
