/**
 * Read in source files from file paths or glob patterns.
 *
 * ```js
 * verb.src('src/*.hbs', {layout: 'default'});
 * ```
 *
 * **Example usage**
 *
 * ```js
 * verb.task('site', function() {
 *   verb.src('src/*.hbs', {layout: 'default'})
 *     verb.dest('dist');
 * });
 * ```
 *
 * @param {String|Array} `glob` Glob patterns or file paths to source files.
 * @param {Object} `options` Options or locals to merge into the context and/or pass to `src` plugins
 * @api public
 */
 module.exports.get = function (req, res, next) {
    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({message: 'Hello World'}));
};

module.exports.config = function () {
  return {
    "route": "/v1/new-endpoint-routing/:id([a-fA-F0-9]{24})?"
  };
}
