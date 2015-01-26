![Serama](../serama.png)

# Installation guide: Ubuntu

## Overview

This document provides a simple step by step guide to installation on Ubuntu [14.04.1 LTS](http://releases.ubuntu.com/14.04.1/).

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

For Serama's tests to run you will need stand alone mongods running at localhost:27017 and localhost:27018. To do this you need to define a new mongod on 27108 -

1. `sudo mkdir data`
2. `sudo mkdir data/db1`
3. `sudo mkdir data/log1`
4. `sudo mongod --dbpath ~/data/db1 --logpath ~/data/log1/log --port 27018 --fork`

### Serama

Install GCC to provide the latest build of the c++ bson extension (not required, but improves performance) -

`sudo apt-get install gcc make build-essential`

Install Git and pull down the latest stable build of Serama -

1. `sudo apt-get install git`
2. `sudo git clone https://github.com/dadiplus/serama.git`
3. `cd serama/`

Install Serama -

*Note:* Serama's log and cache directories are created at startup using settings in the main configuration file `config.json`.


`[sudo] npm install`

Perform Serama's tests -

`[sudo] npm test`

In order to get up and running you will also need to create a client document in the db. To automate this do -

`node utils/create-client.js`

Start Serama -

`[sudo] npm start`

### Forever

To background Serama, install [Forever](https://github.com/nodejitsu/forever) -

`[sudo] npm install forever -g`

You can then start Serama using -

`[sudo] forever start bantam/main.js`
