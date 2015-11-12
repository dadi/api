![Serama](../serama.png)

# Installation guide: Ubuntu

## Overview

This document provides a simple step by step guide to installation on Ubuntu [14.04.1 LTS](http://releases.ubuntu.com/14.04.1/).

This guide assumes a single server holding both the database and the API.

## Installing Serama

### Node.js latest

1. `sudo apt-get -y update`
2. `sudo apt-get -y upgrade`
3. `sudo apt-get -y install python-software-properties`
4. `sudo add-apt-repository ppa:chris-lea/node.js`
5. `sudo apt-get -y update`
6. `sudo apt-get -y install nodejs`

### MongoDB

1. `sudo apt-get -y install mongodb`

For Serama's tests to run you will need stand alone mongods running at localhost:27017 and localhost:27018. To do this you need to define a new mongod on 27108:

1. `sudo mkdir -p data/db1 data/log1`
2. `sudo mongod --dbpath ~/data/db1 --logpath ~/data/log1/log --port 27018 --fork`

### Serama

Install GCC to provide the latest build of the c++ bson extension (not required, but improves performance):

`sudo apt-get install gcc make build-essential`

Install Git and pull down the latest stable build of Serama:

1. `sudo apt-get install git`
2. `sudo git clone https://github.com/bantam-framework/serama.git`
3. `cd serama/`

Install Serama:

*Note:* Serama's log and cache directories are created at startup using settings in the main configuration file `config.json`.

`[sudo] cp config-sample.json config.json`
`[sudo] npm install`

Perform Serama's tests:

`[sudo] npm test`

In order to get up and running you will also need to create a client document in the db. To automate this do:

`node utils/create-client.js`

Start Serama:

`[sudo] npm start`

We can test that our credentials are valid by trying:

`curl -v -X POST -H "Cache-Control: no-cache" -H "content-type: application/json" -d "{ \"clientId\": \"testClient\", \"secret\": \"superSecret\"}" http://127.0.0.1:3000/token`

You should receive a 200 response containing an access token similar to the following

`{"accessToken":"ccb96c94-2ddf-446b-8482-436c9423ae54","tokenType":"Bearer","expiresIn":2592000}`


### Forever

To run Serama in the background, install [Forever](https://github.com/nodejitsu/forever) and [Forever-service](https://github.com/zapty/forever-service):

`[sudo] npm install forever -g`

`[sudo] npm install -g forever-service`

Install Serama as a service and ensure it loads on boot:

`[sudo] forever-service install -s bantam/main.js -e NODE_ENV=production serama --start`

_Note the environment variable - `NODE_ENV=production` - must be set to target the required config version._

You can then interact with Serama as a service using the following command:

- Start: `[sudo] start serama`
- Stop: `[sudo] stop serama`
- Status: `[sudo] status serama`
- Restart `[sudo] restart serama`
