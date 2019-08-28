const convict = require('convict')

const conf = convict({
  app: {
    name: {
      doc: 'The applicaton name',
      format: String,
      default: 'DADI API Repo Default'
    }
  },
  publicUrl: {
    host: {
      doc:
        'The host of the URL where the API instance can be publicly accessed at',
      format: '*',
      default: null,
      env: 'URL_HOST'
    },
    port: {
      doc:
        'The port of the URL where the API instance can be publicly accessed at',
      format: '*',
      default: null,
      env: 'URL_PORT'
    },
    protocol: {
      doc:
        'The protocol of the URL where the API instance can be publicly accessed at',
      format: 'String',
      default: 'http',
      env: 'URL_PROTOCOL'
    }
  },
  server: {
    host: {
      doc:
        'Accept connections on the specified address. If the host is omitted, the server will accept connections on any IPv6 address (::) when IPv6 is available, or any IPv4 address (0.0.0.0) otherwise.',
      format: '*',
      default: null,
      env: 'HOST'
    },
    port: {
      doc:
        'Accept connections on the specified port. A value of zero will assign a random port.',
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
      doc:
        'The filenames of SSL intermediate certificates, overrides sslIntermediateCertificate (singular)',
      format: Array,
      default: [],
      env: 'SSL_INTERMEDIATE_CERTIFICATE_PATHS'
    }
  },
  datastore: {
    doc:
      'The name of the npm module that implements the data connector used for storing documents',
    format: String,
    default: '@dadi/api-mongodb'
  },
  auth: {
    tokenUrl: {
      doc: 'The endpoint used for token generation',
      format: String,
      default: '/token'
    },
    tokenTtl: {
      doc: 'The amount of time (in seconds) which bearer tokens are valid for',
      format: Number,
      default: 1800
    },
    tokenKey: {
      doc: 'The private key used to sign JWT tokens',
      format: String,
      default: '',
      env: 'TOKEN_KEY'
    },
    accessCollection: {
      doc:
        'The name of the internal collection used to store aggregate permissions data',
      format: String,
      default: 'accessStore'
    },
    clientCollection: {
      doc: 'The name of the internal collection used to store clients',
      format: String,
      default: 'clientStore'
    },
    keyAccessCollection: {
      doc:
        'The name of the internal collection used to store aggregate permissions data for keys',
      format: String,
      default: 'keyAccessStore'
    },
    keyCollection: {
      doc: 'The name of the internal collection used to store access keys',
      format: String,
      default: 'keyStore'
    },
    roleCollection: {
      doc: 'The name of the internal collection used to store roles',
      format: String,
      default: 'roleStore'
    },
    datastore: {
      doc:
        'The name of the npm module that implements the data connector used for authentication',
      format: String,
      default: '@dadi/api-mongodb'
    },
    database: {
      doc: 'The name of the database used to store authentication data',
      format: String,
      default: 'test',
      env: 'DB_AUTH_NAME'
    },
    hashSecrets: {
      doc: 'Whether to hash client secrets',
      format: Boolean,
      default: true
    },
    saltRounds: {
      doc: 'The number of rounds to go through when hashing a password',
      format: Number,
      default: 10
    }
  },
  search: {
    database: {
      doc:
        'The name of the database to use for storing and querying indexed documents',
      format: String,
      default: 'search',
      env: 'DB_SEARCH_NAME'
    },
    datastore: {
      doc: 'The datastore to use for storing and querying indexed documents',
      format: String,
      default: ''
    },
    enabled: {
      doc: 'If true, API responds to collection /search endpoints',
      format: Boolean,
      default: false
    },
    indexCollection: {
      doc:
        'The name of the datastore collection that will hold the index of word matches',
      format: String,
      default: 'searchIndex'
    },
    minQueryLength: {
      doc: 'Minimum search string length',
      format: Number,
      default: 3
    },
    wordCollection: {
      doc:
        'The name of the datastore collection that will hold tokenized words',
      format: String,
      default: 'searchWords'
    }
  },
  caching: {
    ttl: {
      doc: '',
      format: Number,
      default: 300
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
        default: './cache/api'
      },
      extension: {
        doc: 'The extension to use for cache files',
        format: String,
        default: 'json'
      },
      autoFlush: {
        doc: '',
        format: Boolean,
        default: true
      },
      autoFlushInterval: {
        doc: '',
        format: Number,
        default: 60
      }
    },
    redis: {
      enabled: {
        doc:
          'If enabled, cache files will be saved to the specified Redis server',
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
      format: ['debug', 'info', 'warn', 'error', 'trace'],
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
        doc:
          'If true, HTTP access logging is enabled. The log file name is similar to the setting used for normal logging, with the addition of "access". For example `api.access.log`.',
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
    collections: {
      doc: 'The relative or absolute path to collection specification files',
      format: String,
      default: 'workspace/collections'
    },
    endpoints: {
      doc: 'The relative or absolute path to custom endpoint files',
      format: String,
      default: 'workspace/endpoints'
    },
    hooks: {
      doc: 'The relative or absolute path to hook specification files',
      format: String,
      default: 'workspace/hooks'
    }
  },
  feedback: {
    doc: '',
    format: Boolean,
    default: false
  },
  status: {
    enabled: {
      doc: 'If true, status endpoint is enabled.',
      format: Boolean,
      default: false
    },
    routes: {
      doc:
        'An array of routes to test. Each route object must contain properties `route` and `expectedResponseTime`.',
      format: Array,
      default: []
    }
  },
  query: {
    useVersionFilter: {
      doc:
        'If true, the API version parameter is extracted from the request URL and passed to the database query',
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
      doc:
        'The duration a signed token is valid for. Expressed in seconds or a string describing a time span (https://github.com/zeit/ms). Eg: 60, "2 days", "10h", "7d"',
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
      doc:
        'Determines the format for the generation of subdirectories to store uploads',
      format: ['none', 'date', 'datetime', 'sha1/4', 'sha1/5', 'sha1/8'],
      default: 'date'
    },
    s3: {
      accessKey: {
        doc:
          'The access key used to connect to an S3-compatible storage provider',
        format: String,
        default: '',
        env: 'AWS_S3_ACCESS_KEY'
      },
      secretKey: {
        doc:
          'The secret key used to connect to an S3-compatible storage provider',
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
        doc: 'The region for an S3-compatible storage provider',
        format: String,
        default: '',
        env: 'AWS_S3_REGION'
      },
      endpoint: {
        doc: 'The endpoint for an S3-compatible storage provider',
        format: String,
        default: ''
      }
    }
  },
  env: {
    doc: 'The applicaton environment.',
    format: String,
    default: 'development',
    env: 'NODE_ENV',
    arg: 'node_env'
  },
  cluster: {
    doc:
      'If true, API runs in cluster mode, starting a worker for each CPU core',
    format: Boolean,
    default: false
  },
  cors: {
    doc:
      'If true, responses will include headers for cross-domain resource sharing',
    format: Boolean,
    default: true
  },
  internalFieldsPrefix: {
    doc: 'The character to be used for prefixing internal fields',
    format: 'String',
    default: '_'
  },
  databaseConnection: {
    maxRetries: {
      doc:
        'The maximum number of times to reconnection attempts after a database fails',
      format: Number,
      default: 10
    }
  },
  i18n: {
    defaultLanguage: {
      doc: 'ISO-639-1 code of the default language',
      format: String,
      default: 'en'
    },
    languages: {
      doc: 'List of ISO-639-1 codes for the supported languages',
      format: Array,
      default: []
    },
    fieldCharacter: {
      doc: 'Special character to denote a translated field',
      format: String,
      default: ':'
    }
  },
  featureQuery: {
    enabled: {
      doc: 'Whether feature query via custom headers is enabled',
      format: Boolean,
      default: true
    }
  },
  workQueue: {
    debounceTime: {
      doc:
        'The amount of idle time (in ms) required for the work queue to start a background job',
      format: Number,
      default: 500
    },
    pollingTime: {
      doc:
        'The interval (in ms) at which the work queue checks for new background jobs',
      format: Number,
      default: 200
    }
  },
  schemas: {
    collection: {
      doc: 'The name of the internal collection to store collection schemas',
      format: String,
      default: 'schemas'
    },
    loadSeeds: {
      doc: 'Whether to scan the workspace directory for collection seed files',
      format: Boolean,
      default: true
    }
  }
})

// Load environment dependent configuration
const env = conf.get('env')

conf.loadFile('./config/config.' + env + '.json')

// Load domain-specific configuration
conf.updateConfigDataForDomain = function(domain) {
  const domainConfig = './config/' + domain + '.json'

  try {
    conf.loadFile(domainConfig)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.log(err)
    }
  }
}

module.exports = conf
module.exports.configPath = function() {
  return './config/config.' + conf.get('env') + '.json'
}
