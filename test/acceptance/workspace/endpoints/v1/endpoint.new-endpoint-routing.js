
module.exports.get = function (req, res, next) {

    var id = "";
    if (req.params && req.params.id) {
      id = req.params.id;
    }

    var message = { message: 'Endpoint with custom route provided through config() function...ID passed = ' + id };

    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify(message));
};

module.exports.config = function () {
  return { "route": "/endpoints/v1/new-endpoint-routing/:id([a-fA-F0-9]{24})?" }
}