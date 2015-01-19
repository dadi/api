![Serama](../serama.png)

# Installation guide: Ubuntu

## Overview

This document provides a simple step by step guide to installation on Ubuntu 14.04.1 LTS.

This guide assumes a single server holding both the database and the API.

## Installing Serama

### Node.js latest

1. `sudo apt-get update`
2. `sudo apt-get upgrade`
3. `sudo apt-get install python-software-properties`
4. `sudo add-apt-repository ppa:chris-lea/node.js`
5. `sudo apt-get update`
6. `sudo apt-get install nodejs`

### MongoDB

1. `sudo apt-get install mongodb`

_For Serama's tests to run you will need stand alone 'mongod's running at localhost:27017 and localhost:27018_

1. `sudo mkdir data`
2. `sudo mkdir data/db1`
3. `sudo mkdir data/log1`
4. `sudo mongod --dbpath ~/data/db1 --logpath ~/data/log1/log --port 27018 --fork`

### Serama

_Install GCC to provide the latest build of the c++ bson extension (not required, but improves performance)_

`sudo apt-get install gcc make build-essential`

_Install Git and pull down the latest stable build of Serama_

1. `sudo apt-get install git`
2. `sudo git clone https://github.com/dadiplus/serama.git`
3. `cd serama/`

_You will need to create Serama's log and cache directories_

1. `sudo mkdir log`
2. `sudo mkdir cache`
3. `sudo mkdir cache/serama`

_Install Serama_

`sudo npm install`

_Perform Serama's tests_

`sudo npm test`

_In order to get up and running you will also need to create a client document in the db. To automate this do_

`node utils/create-client.js`

_Start Serama_

`[sudo] npm start`

### Forever

To background Serama, install [Forever](https://github.com/nodejitsu/forever) -

`[sudo] npm install forever -g`

You can then start Serama using -

`[sudo] forever start bantam/main.js`
