var convict = require('convict');
var fs = require('fs');

// Define a schema
var conf = convict({
  app: {
    name: {
      doc: "The applicaton name",
      format: String,
      default: "DADI API Repo Default"
    }
  },
	server: {
    host: {
      doc: "API IP address",
      format: 'ipaddress',
      default: '0.0.0.0'
    },
    port: {
      doc: "port to bind",
      format: 'port',
      default: 8080
    },
    name: {
      doc: "Server name",
      format: String,
      default: "DADI (API)"
    }
  },
  database: {
      hosts: {
        doc: "",
        format: Array,
        default: [
          {
            host: "127.0.0.1",
            port: 27017
          }
        ]
      },
      username: {
        doc: "",
        format: String,
        default: ""
      },
      password: {
        doc: "",
        format: String,
        default: ""
      },
      database: {
        doc: "",
        format: String,
        default: "serama"
      },
      ssl: {
        doc: "",
        format: Boolean,
        default: false
      },
      replicaSet: {
        doc: "",
        format: String,
        default: ""
      },
      enableCollectionDatabases: {
        doc: "",
        format: Boolean,
        default: false
      }
  },
  auth: {
  	tokenUrl: {
      doc: "",
      format: String,
      default: "/token"
    },
    tokenTtl: {
      doc: "",
      format: Number,
      default: 1800
    },
    clientCollection: {
      doc: "",
      format: String,
      default: "clientStore"
    },
    tokenCollection: {
      doc: "",
      format: String,
      default: "tokenStore"
    },
    database: {
      hosts: {
        doc: "",
        format: Array,
        default: [
          {
            host: "127.0.0.1",
            port: 27017
          }
        ]
      },
      username: {
        doc: "",
        format: String,
        default: ""
      },
      password: {
        doc: "",
        format: String,
        default: ""
      },
      database: {
        doc: "",
        format: String,
        default: "serama"
      }
    }
  },
  caching: {
    ttl: {
      doc: "",
      format: Number,
      default: 300
    },
    directory: {
      enabled: {
        doc: "If enabled, cache files will be saved to the filesystem",
        format: Boolean,
        default: true
      },
      path: {
        doc: "The relative path to the cache directory",
        format: String,
        default: "./cache/web"
      },
      extension: {
        doc: "The extension to use for cache files",
        format: String,
        default: "json"
      }
    },
    redis: {
      enabled: {
        doc: "If enabled, cache files will be saved to the specified Redis server",
        format: Boolean,
        default: false
      },
      host: {
        doc: "The Redis server host",
        format: String,
        default: "127.0.0.1"
      },
      port: {
        doc: "The port for the Redis server",
        format: 'port',
        default: 6379
      },
      password: {
        doc: "",
        format: String,
        default: ""
      }
    }
  },
  logging: {
  	enabled: {
      doc: "If true, logging is enabled using the following settings.",
      format: Boolean,
      default: true
    },
    level: {
      doc: "Sets the logging level.",
      format: ['debug','info','warn','error','trace'],
      default: 'info'
    },
    path: {
      doc: "The absolute or relative path to the directory for log files.",
      format: String,
      default: "./log"
    },
    filename: {
      doc: "The name to use for the log file, without extension.",
      format: String,
      default: "api"
    },
    extension: {
      doc: "The extension to use for the log file.",
      format: String,
      default: "log"
    },
    fileRotationPeriod: {
      doc: "The period at which to rotate the log file. This is a string of the format '$number$scope' where '$scope' is one of 'ms' (milliseconds), 'h' (hours), 'd' (days), 'w' (weeks), 'm' (months), 'y' (years). The following names can be used 'hourly' (= '1h'), 'daily (= '1d'), 'weekly' ('1w'), 'monthly' ('1m'), 'yearly' ('1y').",
      format: String,
      default: ""  // disabled
    },
    fileRetentionCount: {
      doc: "The number of rotated log files to keep.",
      format: Number,
      default: 7    // keep 7 back copies
    },
    accessLog: {
      enabled: {
        doc: "If true, HTTP access logging is enabled. The log file name is similar to the setting used for normal logging, with the addition of 'access'. For example `api.access.log`.",
        format: Boolean,
        default: true
      },
      fileRotationPeriod: {
        doc: "The period at which to rotate the access log file. This is a string of the format '$number$scope' where '$scope' is one of 'ms' (milliseconds), 'h' (hours), 'd' (days), 'w' (weeks), 'm' (months), 'y' (years). The following names can be used 'hourly' (= '1h'), 'daily (= '1d'), 'weekly' ('1w'), 'monthly' ('1m'), 'yearly' ('1y').",
        format: String,
        default: "1d"  // daily rotation
      },
      fileRetentionCount: {
        doc: "The number of rotated log files to keep.",
        format: Number,
        default: 7    // keep 7 back copies
      },
      kinesisStream: {
        doc: "An AWS Kinesis stream to write to log records to.",
        format: String,
        default: ""
      }
    }
  },
  paths: {
    doc: "",
    format: Object,
    default: {
      collections: __dirname + '/workspace/collections',
      endpoints: __dirname + '/workspace/endpoints'
    }
  },
  feedback: {
    doc: "",
    format: Boolean,
    default: false
  },
  health: {
    timeLimit: {
      doc: "Excepted time limit.",
      format: Number,
      default: 10
    },
    routes: {
      doc: "",
      format: Array,
      default: ['/health']
    }
  },
  documentation: {
    title: {
      doc: "The title to display for the API documentation",
      format: String,
      default: "API Documentation"
    },
    description: {
      doc: "A markdown formatted description of the API documentation",
      format: String,
      default: "This is the Content API for a RESTful, composable interface in JSON built on DADI API."
    },
    markdown: {
      doc: "If true, documentation is rendered as raw Markdown",
      format: Boolean,
      default: false
    }
  },
  env: {
    doc: "The applicaton environment.",
    format: ["production", "development", "test", "qa"],
    default: "development",
    env: "NODE_ENV",
    arg: "node_env"
  }
});

// Load environment dependent configuration
var env = conf.get('env');
conf.loadFile('./config/config.' + env + '.json');

// Perform validation
conf.validate({strict: false});

// Load domain-specific configuration
conf.updateConfigDataForDomain = function(domain) {
  var domainConfig = './config/' + domain + '.json';
  try {
    var stats = fs.statSync(domainConfig);
    // no error, file exists
    conf.loadFile(domainConfig);
    conf.validate({strict: false});
  }
  catch(err) {
    if (err.code === 'ENOENT') {
      //console.log('No domain-specific configuration file: ' + domainConfig);
    }
    else {
      console.log(err);
    }
  }
};

module.exports = conf;
module.exports.configPath = function() {
  return './config/config.' + conf.get('env') + '.json';
}
