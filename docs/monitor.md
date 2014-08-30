![Serama](../serama.png)

Docs: Monitor
========

##Overview
========

This module handles file system watching, which is in turn used to update the api.

This is a small wrapper around node.js's `fs.watch` method, which aims to unify this methods behaviour across operating systems.

##Example Usage
=============

    var m = monitor(filepath);
    m.on('change', function (filename) {
        // filename may not exist in every OS
    });
