var convict = require('convict')
var fs = require('fs')

// Define a schema
var conf = convict({
  app: {
    name: {
      doc: 'The applicaton name',
      format: String,
      default: 'DADI API Repo Default',
    }
  },
  publicUrl: {
    host: {
      doc: 'The host of the URL where the API instance can be publicly accessed at',
      format: '*',
      default: null,
      env: 'URL_HOST'
    },
    port: {
      doc: 'The port of the URL where the API instance can be publicly accessed at',
      format: '*',
      default: null,
      env: 'URL_PORT'
    },
    protocol: {
      doc: 'The protocol of the URL where the API instance can be publicly accessed at',
      format: 'String',
      default: 'http',
      env: 'URL_PROTOCOL'
    }
  },
  server: {
    host: {
      doc: 'Accept connections on the specified address. If the host is omitted, the server will accept connections on any IPv6 address (::) when IPv6 is available, or any IPv4 address (0.0.0.0) otherwise.',
      format: '*',
      default: null,
      env: 'HOST'
    },
    port: {
      doc: 'Accept connections on the specified port. A value of zero will assign a random port.',
      format: Number,
      default: 8081,
      env: 'PORT'
    },
    redirectPort: {
      doc: 'Port to redirect http connections to https from',
      format: 'port',
      default: 0,
      env: 'REDIRECT_PORT'
    },
    name: {
      doc: 'Server name',
      format: String,
      default: 'DADI (API)',
    },
    protocol: {
      doc: 'The protocol the web application will use',
      format: String,
      default: 'http',
      env: 'PROTOCOL'
    },
    sslPassphrase: {
      doc: 'The passphrase of the SSL private key',
      format: String,
      default: '',
      env: 'SSL_PRIVATE_KEY_PASSPHRASE'
    },
    sslPrivateKeyPath: {
      doc: 'The filename of the SSL private key',
      format: String,
      default: '',
      env: 'SSL_PRIVATE_KEY_PATH'
    },
    sslCertificatePath: {
      doc: 'The filename of the SSL certificate',
      format: String,
      default: '',
      env: 'SSL_CERTIFICATE_PATH'
    },
    sslIntermediateCertificatePath: {
      doc: 'The filename of an SSL intermediate certificate, if any',
      format: String,
      default: '',
      env: 'SSL_INTERMEDIATE_CERTIFICATE_PATH'
    },
    sslIntermediateCertificatePaths: {
      doc: 'The filenames of SSL intermediate certificates, overrides sslIntermediateCertificate (singular)',
      format: Array,
      default: [],
      env: 'SSL_INTERMEDIATE_CERTIFICATE_PATHS'
    }
  },
  database: {
      hosts: {
        doc: '',
        format: Array,
        default: [
          {
            host: '127.0.0.1',
            port: 27017
          }
        ]
      },
      username: {
        doc: '',
        format: String,
        default: '',
        env: 'DB_USERNAME'
      },
      password: {
        doc: '',
        format: String,
        default: '',
        env: 'DB_PASSWORD'
      },
      database: {
        doc: '',
        format: String,
        default: 'test',
        env: 'DB_NAME'
      },
      ssl: {
        doc: '',
        format: Boolean,
        default: false
      },
      replicaSet: {
        doc: '',
        format: String,
        default: ''
    },
    readPreference: {
      doc: "Choose how MongoDB routes read operations to the members of a replica set - see https://docs.mongodb.com/manual/reference/read-preference/",
      format: ['primary', 'primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest'],
      default: 'secondaryPreferred'
      },
      enableCollectionDatabases: {
        doc: '',
        format: Boolean,
        default: false
      }
  },
  auth: {
    tokenUrl: {
      doc: '',
      format: String,
      default: '/token'
    },
    tokenTtl: {
      doc: '',
      format: Number,
      default: 1800
    },
    clientCollection: {
      doc: '',
      format: String,
      default: 'clientStore'
    },
    tokenCollection: {
      doc: '',
      format: String,
      default: 'tokenStore'
    },
    database: {
      hosts: {
        doc: '',
        format: Array,
        default: [
          {
            host: '127.0.0.1',
            port: 27017
          }
        ]
      },
      username: {
        doc: '',
        format: String,
        default: '',
        env: 'DB_AUTH_USERNAME'
      },
      password: {
        doc: '',
        format: String,
        default: '',
        env: 'DB_AUTH_PASSWORD'
      },
      database: {
        doc: '',
        format: String,
        default: 'test',
        env: 'DB_AUTH_NAME'
      }
    }
  },
  caching: {
    ttl: {
      doc: '',
      format: Number,
      default: 300,
    },
    directory: {
      enabled: {
        doc: 'If enabled, cache files will be saved to the filesystem',
        format: Boolean,
        default: true
      },
      path: {
        doc: 'The relative path to the cache directory',
        format: String,
        default: './cache/web'
      },
      extension: {
        doc: 'The extension to use for cache files',
        format: String,
        default: 'json'
      }
    },
    redis: {
      enabled: {
        doc: 'If enabled, cache files will be saved to the specified Redis server',
        format: Boolean,
        default: false,
        env: 'REDIS_ENABLED'
      },
      host: {
        doc: 'The Redis server host',
        format: String,
        default: '127.0.0.1',
        env: 'REDIS_HOST'
      },
      port: {
        doc: 'The port for the Redis server',
        format: 'port',
        default: 6379,
        env: 'REDIS_PORT'
      },
      password: {
        doc: '',
        format: String,
        default: '',
        env: 'REDIS_PASSWORD'
      }
    }
  },
  logging: {
    enabled: {
      doc: 'If true, logging is enabled using the following settings.',
      format: Boolean,
      default: true
    },
    level: {
      doc: 'Sets the logging level.',
      format: ['debug','info','warn','error','trace'],
      default: 'info'
    },
    path: {
      doc: 'The absolute or relative path to the directory for log files.',
      format: String,
      default: './log'
    },
    filename: {
      doc: 'The name to use for the log file, without extension.',
      format: String,
      default: 'api'
    },
    extension: {
      doc: 'The extension to use for the log file.',
      format: String,
      default: 'log'
    },
    accessLog: {
      enabled: {
        doc: 'If true, HTTP access logging is enabled. The log file name is similar to the setting used for normal logging, with the addition of "access". For example `api.access.log`.',
        format: Boolean,
        default: true
      },
      kinesisStream: {
        doc: 'An AWS Kinesis stream to write to log records to.',
        format: String,
        default: '',
        env: 'KINESIS_STREAM'
      }
    }
  },
  paths: {
    doc: '',
    format: Object,
    default: {
      collections: __dirname + '/workspace/collections',
      endpoints: __dirname + '/workspace/endpoints',
      hooks: __dirname + '/workspace/hooks'
    }
  },
  feedback: {
    doc: '',
    format: Boolean,
    default: false,
  },
  status: {
    enabled: {
      doc: 'If true, status endpoint is enabled.',
      format: Boolean,
      default: false,
    },
    routes: {
      doc: 'An array of routes to test. Each route object must contain properties `route` and `expectedResponseTime`.',
      format: Array,
      default: []
    }
  },
  query: {
    useVersionFilter: {
      doc: 'If true, the API version parameter is extracted from the request URL and passed to the database query',
      format: Boolean,
      default: false
    }
  },
  media: {
    defaultBucket: {
      doc: 'The name of the default media bucket',
      format: String,
      default: 'mediaStore'
    },
    buckets: {
      doc: 'The names of media buckets to be used',
      format: Array,
      default: []
    },
    tokenSecret: {
      doc: 'The secret key used to sign and verify tokens when uploading media',
      format: String,
      default: 'catboat-beatific-drizzle'
    },
    tokenExpiresIn: {
      doc: 'The duration a signed token is valid for. Expressed in seconds or a string describing a time span (https://github.com/zeit/ms). Eg: 60, "2 days", "10h", "7d"',
      format: '*',
      default: '1h'
    },
    storage: {
      doc: 'Determines the storage type for uploads',
      format: ['disk', 's3'],
      default: 'disk'
    },
    basePath: {
      doc: 'Sets the root directory for uploads',
      format: String,
      default: 'workspace/media'
    },
    pathFormat: {
      doc: 'Determines the format for the generation of subdirectories to store uploads',
      format: ['none', 'date', 'datetime', 'sha1/4', 'sha1/5', 'sha1/8'],
      default: 'date'
    },
    s3: {
      accessKey: {
        doc: 'The AWS access key used to connect to S3',
        format: String,
        default: '',
        env: 'AWS_S3_ACCESS_KEY'
      },
      secretKey: {
        doc: 'The AWS secret key used to connect to S3',
        format: String,
        default: '',
        env: 'AWS_S3_SECRET_KEY'
      },
      bucketName: {
        doc: 'The name of the S3 bucket in which to store uploads',
        format: String,
        default: '',
        env: 'AWS_S3_BUCKET_NAME'
      },
      region: {
        doc: 'The AWS region',
        format: String,
        default: '',
        env: 'AWS_S3_REGION'
      }
    }
  },
  env: {
    doc: 'The applicaton environment.',
    format: ['production', 'development', 'test', 'qa'],
    default: 'development',
    env: 'NODE_ENV',
    arg: 'node_env'
  },
  cluster: {
    doc: 'If true, API runs in cluster mode, starting a worker for each CPU core',
    format: Boolean,
    default: false
  },
  cors: {
    doc: 'If true, responses will include headers for cross-domain resource sharing',
    format: Boolean,
    default: false
  }
})

// Load environment dependent configuration
var env = conf.get('env')
conf.loadFile('./config/config.' + env + '.json')

// Perform validation
conf.validate()

// Load domain-specific configuration
conf.updateConfigDataForDomain = function(domain) {
  var domainConfig = './config/' + domain + '.json'
  try {
    var stats = fs.statSync(domainConfig)
    // no error, file exists
    conf.loadFile(domainConfig)
    conf.validate()
  }
  catch(err) {
    if (err.code === 'ENOENT') {
      //console.log('No domain-specific configuration file: ' + domainConfig)
    }
    else {
      console.log(err)
    }
  }
}

module.exports = conf
module.exports.configPath = function() {
  return './config/config.' + conf.get('env') + '.json'
}
