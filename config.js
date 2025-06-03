// Configuration file for MongoDB and other settings
export const config = {
  // Database Configuration
  mongodb: {
    // تم التحديث بواسطة المستخدم مباشرة
    atlasUri: process.env.MONGODB_ATLAS_URI || 'mongodb+srv://ghem:ghem@ghem.eqxqd5j.mongodb.net/perf?retryWrites=true&w=majority&appName=ghem',
    dockerUri: process.env.MONGODB_DOCKER_URI || 'mongodb://mongodb:27017/perf', // Changed to perf
    localUri: process.env.MONGODB_LOCAL_URI || 'mongodb://localhost:27017/perf', // Changed to perf
    dbName: process.env.DB_NAME || 'perf', // Ensure this is 'perf'
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development'
  },

  // Email Configuration
  email: {
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'am1322460@gmail.com',
      pass: 'hqww szea ruof uuyy'
    },
    from: {
      name: 'ghem.store',
      address: 'am1322460@gmail.com'
    },
    pool: true,
    maxConnections: 1,
    rateDelta: 20000,
    rateLimit: 5,
    tls: {
      rejectUnauthorized: false
    },
    dkim: {
      domainName: 'gmail.com',
      keySelector: 'default',
      privateKey: false
    }
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
  }
};

// Helper function to get MongoDB URI based on environment
export const getMongoUri = () => {
  // إذا كان متاح في environment variables
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }
  
  // إذا كان يعمل في Docker
  if (process.env.NODE_ENV === 'docker' || process.env.DOCKER_ENV) {
    return config.mongodb.dockerUri;
  }
  
  // إذا كان يعمل محلياً
  if (process.env.NODE_ENV === 'local') {
    return config.mongodb.localUri;
  }
  
  // الافتراضي هو MongoDB Atlas
  return config.mongodb.atlasUri;
};