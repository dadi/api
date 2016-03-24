var config = require(__dirname + '/../../../config');

/**
 * Creates a new hook. Allowed types:
 *
 * beforeCreate
 * afterCreate
 * beforeUpdate
 * afterUpdate
 * beforeDelete
 * afterDelete
 *
 * @param Mixed Hook data
 * @param Number Hook type
 * @return Hook
 * @api public
 */
var Hook = function (data, type) {
  if (typeof data === 'string') {
    this.name = data;
  } else {
    this.name = data.hook;
    this.options = data.options;
  }

  this.hook = this.load();
  this.type = type;
};

/**
 * Calls the hook function with the appropriate parameters based
 * on the hook type
 *
 * @param Mixed Hook arguments
 * @return Obj
 * @api public
 */
Hook.prototype.apply = function () {
  switch (this.type) {
    case 'beforeCreate':
      return this.hook(arguments[0], this.type, {
        options: this.options
      });

    case 'afterCreate':
      return this.hook(arguments[0], this.type, {
        options: this.options
      });

    case 'beforeUpdate':
      return this.hook(arguments[0], this.type, {
        updatedDocs: arguments[1],
        options: this.options
      });

    case 'afterUpdate':
      return this.hook(arguments[0], this.type, {
        options: this.options
      });

    case 'beforeDelete':
      return this.hook(arguments[0], this.type, {
        options: this.options
      });

    case 'afterDelete':
      return this.hook(arguments[0], this.type, {
        options: this.options
      });
  }

  return false;
};

Hook.prototype.load = function () {
  return require(config.get('paths.hooks') + '/' + this.name);
}

module.exports = function (data, type) {
  return new Hook(data, type);
};

module.exports.Hook = Hook;
