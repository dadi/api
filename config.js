var convict = require('convict');

// Define a schema
var conf = convict({
  app: {
    name: {
      doc: "The applicaton name",
      format: String,
      default: "Serama Repo Default"
    }
  },
	server: {
    host: {
      doc: "Serama IP address",
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
      default: "Bantam (Serama)"
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
      default: 2592000
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
      default: "./cache/serama/"
    },
    extension: {
      doc: "",
      format: String,
      default: "json"
    }
  },
  logging: {
  	enabled: {
      doc: "Determines if logging is enabled",
      format: Boolean,
      default: true
    },
    level: {
      doc: "",
      format: String,
      default: "DEBUG"
    },
    path: {
      doc: "",
      format: String,
      default: "./log"
    },
    filename: {
      doc: "",
      format: String,
      default: "rosecomb"
    },
    dateFormat: {
      doc: "",
      format: String,
      default: ""
    },
    extension: {
      doc: "",
      format: String,
      default: "log"
    },
    messageFormat: {
      doc: "",
      format: String,
      default: "<%= label %> - <%= date %> - <%= message %>"
    }
  },
  feedback: {
    doc: "",
    format: Boolean,
    default: false
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
