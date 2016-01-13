module.exports.get = function (req, res, next) {
    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({message: 'Hello World'}));
};

module.exports.config = function () {
  return {
    "route": "/v1/new-endpoint-routing/:id([a-fA-F0-9]{24})?",
    "displayName": "Test Endpoint",
    "shortDescription": "For testing, innit.",
    "description": "For testing, innit. For testing, innit. For testing, innit. For testing, innit. For testing, innit. For testing, innit."
  };
}
