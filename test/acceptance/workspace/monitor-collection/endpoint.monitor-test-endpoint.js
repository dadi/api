var message = 'version 1';

module.exports.get = function (req, res, next) {
    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;

    res.end(JSON.stringify({message: message}));
};
