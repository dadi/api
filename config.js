var convict = require('convict');
var fs = require('fs');

// Define a schema
var conf = convict({
  app: {
    name: {
      doc: "The applicaton name",
      format: String,
      default: "DADI API Repo Default",
      env: "API_APP_NAME"
    }
  },
	server: {
    host: {
      doc: "Accept connections on the specified address. If the host is omitted, the server will accept connections on any IPv6 address (::) when IPv6 is available, or any IPv4 address (0.0.0.0) otherwise.",
      format: '*',
      default: null,
      env: "API_HOST"
    },
    port: {
      doc: "Accept connections on the specified port. A value of zero will assign a random port.",
      format: Number,
      default: 8081,
      env: "API_PORT"
    },
    name: {
      doc: "Server name",
      format: String,
      default: "DADI (API)",
      env: "API_NAME"
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
      default: 300,
      env: "API_CACHING_TTL"
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
        default: false,
        env: "API_REDIS_ENABLED"
      },
      host: {
        doc: "The Redis server host",
        format: String,
        default: "127.0.0.1",
        env: "REDIS_HOST"
      },
      port: {
        doc: "The port for the Redis server",
        format: 'port',
        default: 6379,
        env: "REDIS_PORT"
      },
      password: {
        doc: "",
        format: String,
        default: "",
        env: "REDIS_PASSWORD"
      }
    }
  },
  logging: {
  	enabled: {
      doc: "If true, logging is enabled using the following settings.",
      format: Boolean,
      default: true,
      env: "API_LOGGING_ENABLED"
    },
    level: {
      doc: "Sets the logging level.",
      format: ['debug','info','warn','error','trace'],
      default: 'info'
    },
    path: {
      doc: "The absolute or relative path to the directory for log files.",
      format: String,
      default: "./log",
      env: "API_LOG_PATH"
    },
    filename: {
      doc: "The name to use for the log file, without extension.",
      format: String,
      default: "api",
      env: "API_LOG_FILENAME"
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
        default: true,
        env: "API_ACCESSLOG_ENABLED"
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
        default: "",
        env: "API_KINESISSTREAM"
      }
    }
  },
  paths: {
    doc: "",
    format: Object,
    default: {
      collections: __dirname + '/workspace/collections',
      endpoints: __dirname + '/workspace/endpoints',
      hooks: __dirname + '/workspace/hooks'
    }
  },
  feedback: {
    doc: "",
    format: Boolean,
    default: false,
    env: 'API_FEEDBACK'
  },
  status: {
  	enabled: {
      doc: "If true, status endpoint is enabled.",
      format: Boolean,
      default: false,
      env: "API_STATUS_ENABLED"
    },
    routes: {
      doc: "An array of routes to test. Each route object must contain properties `route` and `expectedResponseTime`.",
      format: Array,
      default: []
    }
  },
  query: {
    useVersionFilter: {
      doc: "If true, the API version parameter is extracted from the request URL and passed to the database query",
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
  },
  cluster: {
    doc: "If true, API runs in cluster mode, starting a worker for each CPU core",
    format: Boolean,
    default: false,
    env: "API_CLUSTER"
  },
  cors: {
    doc: "If true, responses will include headers for cross-domain resource sharing",
    format: Boolean,
    default: false,
    env: "API_CORS"
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
