var inflection = require('inflection');
var _ = require('underscore');

// underscore templating, using Mustache syntax
_.templateSettings = {
  interpolate: /\{\{(.+?)\}\}/g
};
var endpointMethodTemplate = "### {{ shortDescription }} [{{ method }}]\n";
    endpointMethodTemplate += "{{ description }}\n\n";

var singleResourceMethodTemplate = "### {{ action }} a single {{ modelName }} [{{ method }}]\n";
    singleResourceMethodTemplate += "{{ actionResponse }} a single {{ modelName }} matching the specified ID, or returns HTTP 404 if no matching {{ pluralizedName }} were found.\n\n";

var fieldTemplate = " // {{ type }}{{ required }}";

var modelSchemaFieldTemplate = ">>>\"{{ key }}\": \" {{ example }}\"{{ delimiter }} {{ detail }} \n";

var modelResourceTemplate = "+ Model (application/json)\n\n";
    modelResourceTemplate += ">JSON representation of {{ pluralizedName }}.\n\n";
    modelResourceTemplate += ">+ Body\n\n";
    modelResourceTemplate += "{{ modelSpec }}";
    modelResourceTemplate += "\n\n";

var modelListTemplate = "### Retrieve a list of {{ pluralizedName }} [GET]\n\n";
    modelListTemplate += "Returns an array of {{ pluralizedName }}.\n";
    modelListTemplate += "+ Response 200\n\n";
    modelListTemplate += ">[ {{ modelName }} Collection][]\n\n";

var modelListGroupTemplate = "## {{ modelName }} Collection [{{ path }}]\n";
    modelListGroupTemplate += "Collection of all {{ pluralizedName }}.\n\n";
    modelListGroupTemplate += "{{ namedResource }}";

var modelGroupTemplate = "# Group {{ modelName }}\n {{ description }}\n";
    modelGroupTemplate += "## {{ modelName }} [{{ path }}]\n";
    modelGroupTemplate += "Resources for working with a single {{ modelName }}.\n\n";

var fourohfourTemplate = "+ Response 404\n";
    fourohfourTemplate += "Returned if no {{ pluralizedName }} matched the supplied ID.";
    fourohfourTemplate += "\n    + Body\n\n";


var templates = [];

templates["field"]                = _.template(fieldTemplate);
templates["modelList"]            = _.template(modelListTemplate);
templates["modelSchemaField"]     = _.template(modelSchemaFieldTemplate);
templates["modelResource"]        = _.template(modelResourceTemplate);
templates["singleResourceMethod"] = _.template(singleResourceMethodTemplate);
templates["modelListGroup"]       = _.template(modelListGroupTemplate);
templates["modelGroup"]           = _.template(modelGroupTemplate);
templates["fourohfour"]           = _.template(fourohfourTemplate);
templates["endpointMethod"]       = _.template(endpointMethodTemplate);

var Blueprint = function(model, path, route) {

  this.path = path;

  if (model) {
    //this.model = Model(model.name);
    this.model = model;

    if (this.model.settings.hasOwnProperty("displayName")) {
      this.modelName = this.model.settings.displayName;
    }
    else {
      // set the model name, singularizing it if the collection was provided as pluralized
      this.modelName = inflection.inflect(this.model.name.charAt(0).toUpperCase() + this.model.name.substring(1), 1);
    }

    this.pluralizedName = inflection.inflect(this.modelName, 2);
  }
  else if (route) {
    this.route = route;
    this.routeConfig = this.route.config ? this.route.config() : {};
    this.modelName = this.path;

    // if (this.route.config) {
    //   var config = this.route.config();
    //   if (config.route) {
    //     this.path = config.route;
    //   }
    // }
  }
}

Blueprint.prototype.name = function() {
  if (this.route && this.routeConfig) {
    if (this.routeConfig.displayName) {
      return this.routeConfig.displayName;
    }
  }
  return this.modelName;
}

Blueprint.prototype.description = function() {
  if (this.route && this.routeConfig) {
    if (this.routeConfig.description) {
        return this.routeConfig.description + "\n\n";
    }
  }
  else if (this.model && this.model.settings.description) {
    return this.model.settings.description + "\n\n";
  }
  else {
    return "\n";
  }
}

Blueprint.prototype.modelSpec = function(asArray) {
    var blueprint = "";
    var numRepeats = asArray ? 2 : 1;
    var apiVersion = this.path.split('/')[1];

    if (!this.model) return "";

    if (this.model.schema) {
        if (asArray) blueprint += ">>>>>>>>[\n";
        for (i = 1; i <= numRepeats; i++) {
            blueprint += ">>{\n";
            blueprint += ">>>>\"" + "_id" + "\": \"" + "54a0f7427269607fc01f4fc6" + "\",\n";

            var idx = 0;
            _.each(this.model.schema, function(value, key, list) {
                idx++;
                blueprint += ">>>>\"" + key + "\": \"" + value.example + "\"" + "," + "\n";
            });

            blueprint += ">>>>\"" + "apiVersion" + "\": \"" + apiVersion + "\",\n";
            blueprint += ">>>>\"" + "createdAt" + "\": \"" + "1419835202816" + "\"," + "\n";
            blueprint += ">>>>\"" + "createdBy" + "\": \"" + "user123" + "\"\n";

            blueprint += ">>}" + (i==1 && asArray ? "," : "") + "\n";
        }

        if (asArray) blueprint += ">>>>>>>>]\n";

        blueprint += "\n";
    }

    return blueprint;
}

Blueprint.prototype.groupName = function() {
  var md = "";
  md += templates["modelGroup"]({modelName: this.name(), description: this.description(), path: replaceIdParam(this.path)});
  md += this.modelResource();
  return md;
}

Blueprint.prototype.endpointMethod = function() {
    var md = "";
    md += templates["endpointMethod"]({modelName: this.name(), pluralizedName: this.pluralizedName, shortDescription: this.routeConfig.shortDescription, description: this.routeConfig.description, method: 'GET'});
console.log(md)
    md += "+ Parameters\n";
    md += ">" + "+ id (string) ... the ID of the " + this.name() + " to retrieve\n\n";

    md += "+ Response 200\n";
    md += "\n";
    md += ">" + "[" + this.name() + "][]\n\n";
    return md;
}

Blueprint.prototype.getMethod = function() {
    var md = "";
    md += templates["singleResourceMethod"]({modelName: this.name(), pluralizedName: this.pluralizedName, action: 'Retrieve', actionResponse: 'Returns', method: 'GET'});

    md += "+ Parameters\n";
    md += ">" + "+ id (string) ... the ID of the " + this.name() + " to retrieve\n\n";

    md += "+ Response 200\n";
    md += "\n";
    md += ">" + "[" + this.name() + "][]\n\n";
    return md;
}

Blueprint.prototype.updateMethod = function() {
    var md = "";
    md += templates["singleResourceMethod"]({modelName: this.modelName, pluralizedName: this.pluralizedName, action: 'Update', actionResponse: 'Edits', method: 'PUT'});

    md += "+ Parameters\n";
    md += ">" + "+ id (string) ... the ID of the " + this.modelName + " to update\n\n";

    md += renderRequestFields(this.model);

    md += templates["fourohfour"]({pluralizedName: this.pluralizedName});

    return md;
}

Blueprint.prototype.deleteMethod = function() {
    var md = "";
    md += templates["singleResourceMethod"]({modelName: this.modelName, pluralizedName: this.pluralizedName, action: 'Delete', actionResponse: 'Deletes', method: 'DELETE'});

    md += "+ Parameters\n";
    md += ">" + "+ id (string) ... the ID of the " + this.modelName + " to delete\n\n";

    md += "+ Response 204\n";
    md += "Returned if a " + this.modelName + " matched the supplied ID and was deleted successfully.";
    md += "\n\n";
    md += ">" + "+ Body" + "\n" + "\n";

    md += templates["fourohfour"]({pluralizedName: this.pluralizedName});

    return md;
}

Blueprint.prototype.createMethod = function() {
    var md = "";
    md += "### Create a new " + this.modelName + " [POST]\n\n";
    md += "Creates a new " + this.modelName + " document in the database.\n\n";
    md += "\n";

    md += "The following fields are automatically added to new " + this.modelName + " documents:" + "\n\n";
    md += "- _id" + "\n";
    md += "- apiVersion" + "\n";
    md += "- createdAt" + "\n";
    md += "- createdBy" + "\n";
    md += "\n";

    md += renderRequestFields(this.model);

    md += "+ Response 200\n";
    md += "\n";
    md += "    " + "[" + this.modelName + "][]\n\n";

    md += "+ Response 400 (application/json)\n";
    md += "If the new " + this.modelName + " fails validation, an HTTP 400 response is returned with an errors collection containing the fields that failed validation."  + "\n";
    md += "\n";
    //doc += "    " + "[" + name + "][]\n\n";

    md += ">" + "+ Body" + "\n" + "\n";
    md += ">>" + "{" + "\n";
    md += ">>>>" + "\"success\": false," + "\n";
    md += ">>>>" + "\"errors\": [" + "\n";

    _.each(this.model.schema, function(value, key, list) {
        if (value.required) {
          md += ">>>>>>" + "{" + "\n";
          md += ">>>>>>>>" + "\"field\": \"" + key + "\"," + "\n";
          md += ">>>>>>>>" + "\"message\": \"" + (value.message==""?"can\'t be blank":value.message) + "\"" + "\n";
          md += ">>>>>>" + "}" + "\n";
        }
    });

    md += ">>>>" + "]" + "\n";
    md += ">>" + "}";

    md += "\n";
    md += "\n";

    return md;
}

Blueprint.prototype.modelListGroup = function() {
  if (!this.modelName) return "";
  return templates["modelListGroup"]({ modelName: this.modelName, pluralizedName: this.pluralizedName, path: removeIdParam(this.path), namedResource: this.modelResource() });
}

Blueprint.prototype.modelResource = function() {
  return templates["modelResource"]({ pluralizedName: this.pluralizedName, modelSpec: this.modelSpec(false) });
}

Blueprint.prototype.modelListMethod = function() {
  return templates["modelList"]({ modelName: this.modelName, pluralizedName: this.pluralizedName });
}

// route id component
var idParam = ':id([a-fA-F0-9]{24})?';

function replaceIdParam(path) {
    return path.replace(idParam, "{id}");
}

function removeIdParam(path) {
    return path.replace(idParam, "");
}

function processField(value) {
    return templates["field"]({ type: value.type, required: (value.required ? ", required" : "")});
}

function sortFields(obj) {
  var sortedObj = {}, keys = _.keys(obj);
  keys = _.sortBy(keys, function(key){
    return key;
  });

  _.each(keys, function(key) {
    sortedObj[key] = obj[key];
  });

  return sortedObj;
}

function renderRequestFields(model) {
    var md = "";
    md += "+ Request\n\n";

    if (model.schema) {

      var publicFields = {}, requiredFields = {}, optionalFields = {};
      _.each(model.schema, function (field, key) {
        if (field.display && field.display.hasOwnProperty('index') && field.display.index === true) {
          publicFields[key] = field;
        }
      });

      _.each(publicFields, function (field, key) {
        if (field.required) {
          requiredFields[key] = field;
        }
        else {
          optionalFields[key] = field;
        }
      });

      requiredFields = sortFields(requiredFields);
      optionalFields = sortFields(optionalFields);

      var idx = 0;
      var len = Object.keys(publicFields).length;

      md += ">>" + "{\n";

      _.each(requiredFields, function(value, key) {
        idx++;
        md += templates["modelSchemaField"]({ key: key, example: value.example, detail: processField(value), delimiter: (idx < len ? "," : "") });
      });

      _.each(optionalFields, function(value, key) {
        idx++;
        md += templates["modelSchemaField"]({ key: key, example: value.example, detail: processField(value), delimiter: (idx < len ? "," : "") });
      });

      md += ">>" + "}\n\n";
    }

    return md;
}

// exports
module.exports = function (model, path, route) {
  if (model) return new Blueprint(model, path, null);
  if (route) return new Blueprint(null, path, route);
};

module.exports.Blueprint = Blueprint;
