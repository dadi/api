var config = require(__dirname + '/../../../config');

/**
 * Creates a new hook. Allowed types:
 *
 * 0: Create
 * 1: Update
 * 2: Delete
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

	this.hook = require(config.get('paths.hooks') + '/' + this.name);
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
		case 0: // Create
			return this.hook(arguments[0], this.type, {
				options: this.options
			});

		case 1: // Update
			return this.hook(arguments[0], this.type, {
				updatedDocs: arguments[1],
				options: this.options
			});

		case 2: // Delete
			return this.hook(arguments[0], this.type, {
				options: this.options
			});
	}

	return false;
};

module.exports = function (data, type) {
	return new Hook(data, type);
};