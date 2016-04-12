/**
 * Adds two numbers together.
 *
 * **Example usage**
 *
 * ```js
 * var result = add(1, 2);
 * ```
 *
 * @param {int} `num1` The first number.
 * @param {int} `num2` The second number.
 * @returns {int} The sum of the two numbers.
 * @api public
 */

module.exports.get = function (req, res, next) {
    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({message: 'Hello World'}));
};
