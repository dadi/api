![Serama](../serama.png)

# Extention API

## Overview

Serama includes an API to extend the framework's functionality. It enables developers to add routes and middleware to Serama's server.

## Example Usage

    var app = require('serama/lib/'); // path to serama

    app.start({

        // path to collections directory
        collectionPath: 'workspace/collections',

        // path to endpoints directory
        endpointPath: 'workspace/endpoints'
    });

    // attach middleware to be called on all requests
    app.api.use(function (req, res, next) {

        // parse cookies out of the 
        var userId = parseCookie(req);
        userLookup(userId, function (err, user) {
            if (err) return next(err);
            if (user) {

                // attach user object to the request to use with other middleware
                req.user = user;

                // call the next middleware
                return next();
            }

            // reject the request
            err = new Error('Not Authorized');
            err.statusCode = 401;
            next(err);
        });
    });

    // attach error handling middleware.
    // Note: functions with 4 arguments are treated as error handlers
    app.api.use(function (err, req, res, next) {

        // log to console
        console.log(err);

        // modify error and call next handler
        err.logged = true;
        next(err);
    });

    // attach a route handler for GET requests to the path that start with
    // `/foo` followed by any other value.
    // Note: the first argument string is parsed using the `path-to-regexp` 
    // node.js module.  This is the same way connect and express parse route 
    // strings.
    // see [https://github.com/component/path-to-regexp](https://github.com/component/path-to-regexp) for info
    app.get('/foo/:id', function (req, res, next) {
        var id = req.params.id;
        console.log('foo ID is ' + id);
        res.setHeader('content-type', 'text/plain');
        res.statusCode = 200;
        res.end('Thanks foo');
    });

## Methods

Serama's underlying server api is available at `app.api`

This exposes the follwing methods -

### app.api.use([route], handler)

- route
	- An optional string that limits this handler to the given path string
- handler
	- A function that is passed (http.IncomingMessage, http.ServerResponse, next)
	- The first two arguments are the request and response instances that node.js creates internally, the third argument is a function that can be called to start the next middleware
	- If next is called with anything as the first argument, the rest of your middleware and routes are skipped and your error handlers are called

### app.api.unuse(route or function)

- the first argument to `unuse` is either a String or Function
	- If it is a Function Serama will remove the Function from the middleware if it exists
	- If the first argument is a string, it will remove that route from the middleware

### app.VERB(route, handler, [any number of additional handlers])

`VERB` can be any of the http methods, e.g. `app.get`, `app.post`, `app.head`

- route must be a path string for use with [path-to-regexp](https://github.com/component/path-to-regexp)
- handler is a function that recieves (req, res, next) just like the middleware declared with `.use`

_NOTE: you can add any number of handlers, and they will be called in the order they were added_

## Notes

On top of routes for collections and endpoints, some middleware is added by Serama for use internally, these include -

  - [body-parser](https://github.com/expressjs/body-parser).  The `json` and `text` middlewares are used
  - A request logger middleware is added
  - A middleware for serving and authorizing Bearer tokens is used
  - A request caching middleware is added