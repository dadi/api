var convict = require('convict');

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
        format: Boolean,
        default: false
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
      },
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
  caching: {
    enabled: {
      doc: "Determines if caching is enabled",
      format: Boolean,
      default: true
    },
    ttl: {
      doc: "",
      format: Number,
      default: 300
    },
    directory: {
      doc: "",
      format: String,
      default: "./cache/api/"
    },
    extension: {
      doc: "",
      format: String,
      default: "json"
    }
  },
  logging: {
  	enabled: {
      doc: "If true, logging is enabled using the following settings.",
      format: Boolean,
      default: true
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
  feedback: {
    doc: "",
    format: Boolean,
    default: false
  },
  documentation: {
    enabled: {
      doc: "If true, API documentation is available at /api/docs",
      format: Boolean,
      default: true
    },
    title: {
      doc: "The title to display for the API documentation",
      format: String,
      default: "API Documentation"
    },
    description: {
      doc: "A markdown formatted description of the API documentation",
      format: String,
      default: "This is the content API for [Example](http://www.example.com), a RESTful, composable interface in JSON built on DADI API."
    },
    markdown: {
      doc: "If true, documentation is rendered a raw Markdown",
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

module.exports = conf;
module.exports.configPath = function() {
  return './config/config.' + conf.get('env') + '.json';
}
