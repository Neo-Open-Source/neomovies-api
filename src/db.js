const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || process.env.mongodb_uri || process.env.MONGO_URI;

if (!uri) {
  throw new Error('MONGODB_URI environment variable is not set');
}

let client;
let clientPromise;

const clientOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  retryWrites: true,
  w: 'majority',
  
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true
  }
};

// Connection management
if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, clientOptions);
    global._mongoClientPromise = client.connect();
    console.log('MongoDB connection initialized in development');
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, clientOptions);
  clientPromise = client.connect();
  console.log('MongoDB connection initialized in production');
}



async function getDb() {
  try {
    const mongoClient = await clientPromise;
    return mongoClient.db();
  } catch (error) {
    console.error('Error getting MongoDB database:', error);
    throw error;
  }
}

async function closeConnection() {
  if (client) {
    try {
      await client.close(true);
      client = null;
      global._mongoClientPromise = null;
      console.log('MongoDB connection closed');
    } catch (error) {
      console.error('Error closing MongoDB connection:', error);
    }
  }
}

// Clean up handlers
const cleanup = async () => {
  await closeConnection();
  process.exit(0);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

process.on('uncaughtException', async (err) => {
  console.error('Uncaught Exception:', err);
  await closeConnection();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled Rejection:', reason);
  await closeConnection();
  process.exit(1);
});

module.exports = { getDb, closeConnection };
