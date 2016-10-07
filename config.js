var convict = require('convict');
var fs = require('fs');

// Define a schema
var conf = convict({
  app: {
    name: {
      doc: "The applicaton name",
      format: String,
      default: "DADI API Repo Default",
    }
  },
  server: {
    host: {
      doc: "Accept connections on the specified address. If the host is omitted, the server will accept connections on any IPv6 address (::) when IPv6 is available, or any IPv4 address (0.0.0.0) otherwise.",
      format: '*',
      default: null,
      env: "HOST"
    },
    port: {
      doc: "Accept connections on the specified port. A value of zero will assign a random port.",
      format: Number,
      default: 8081,
      env: "PORT"
    },
    name: {
      doc: "Server name",
      format: String,
      default: "DADI (API)",
    },
    protocol: {
      doc: "The protocol the web application will use",
      format: String,
      default: "http",
      env: "PROTOCOL"
    },
    sslPassphrase: {
      doc: "The passphrase of the SSL private key",
      format: String,
      default: "",
      env: "SSL_PRIVATE_KEY_PASSPHRASE"
    },
    sslPrivateKeyPath: {
      doc: "The filename of the SSL private key",
      format: String,
      default: "",
      env: "SSL_PRIVATE_KEY_PATH"
    },
    sslCertificatePath: {
      doc: "The filename of the SSL certificate",
      format: String,
      default: "",
      env: "SSL_CERTIFICATE_PATH"
    },
    sslIntermediateCertificatePath: {
      doc: "The filename of an SSL intermediate certificate, if any",
      format: String,
      default: "",
      env: "SSL_INTERMEDIATE_CERTIFICATE_PATH"
    },
    sslIntermediateCertificatePaths: {
      doc: "The filenames of SSL intermediate certificates, overrides sslIntermediateCertificate (singular)",
      format: Array,
      default: [],
      env: "SSL_INTERMEDIATE_CERTIFICATE_PATHS"
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
        default: "test"
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
        default: "test"
      }
    }
  },
  caching: {
    ttl: {
      doc: "",
      format: Number,
      default: 300,
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
        env: "REDIS_ENABLED"
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
    accessLog: {
      enabled: {
        doc: "If true, HTTP access logging is enabled. The log file name is similar to the setting used for normal logging, with the addition of 'access'. For example `api.access.log`.",
        format: Boolean,
        default: true
      },
      kinesisStream: {
        doc: "An AWS Kinesis stream to write to log records to.",
        format: String,
        default: "",
        env: "KINESIS_STREAM"
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
  },
  status: {
    enabled: {
      doc: "If true, status endpoint is enabled.",
      format: Boolean,
      default: false,
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
    default: false
  },
  cors: {
    doc: "If true, responses will include headers for cross-domain resource sharing",
    format: Boolean,
    default: false
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
