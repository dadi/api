![Serama](../serama.png)

# API

## Overview

This module is responsible for creating a server and dispatching requests to middleware and routing.

The main function this exposes is `use`.  It is similar to express.js's `app.use`. A default error handler and a 404 handler are automatically added.

## Example Usage

The `use` method does different things depending on what is passed to it -

    var app = api();

    // if a function with arity === 3 is passed it is treated as middleware.
    // This will be called in the order its added, and before any routes
    app.use(function (req, res, next) {});

    // if a function with arity === 4 is passed it is treated as an error handler.
    // This will be called if any route or middleware passes an error to `next`
    app.use(function (err, req, res, next) {});

    // if the first arg is a string, it is treated as a route
    // the string will be matched against `req.url`
    app.use('/my_uri', function (req, res, next) {
        var query = url.parse(req.url, true).query;

        // pass req to controller, etc...
    });


var app = require('dadi-api');
var config = require('dadi-api').Config;
var model = require('dadi-api').Model;
