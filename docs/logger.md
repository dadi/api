![Serama](../serama.png)

Docs: Logger
========

##Overview
========

This module exposes three methods -

`debug`

`stage`

`prod`

Depending on the level specified in the config.json file, calls to these messages either log to the file system, or do nothing.

##Levels
======

  - 'DEBUG' - most verbose, all logging is persisted
  - 'STAGE' - medium logging, calls to `stage`, and `prod` are persisted.  Calls to `debug` are ignored
  - 'PROD' - least amount of logging, only calls to `prod` are persisted.  All others are ignored

##Example Usage
=============

`var logger = require('./bantam/lib/log');`

`logger.debug('debug message');`

`logger.prod('message for production');`
