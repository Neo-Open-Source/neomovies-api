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
async function initializeClient() {
  try {
    client = new MongoClient(uri, clientOptions);
    
    // Minimal essential monitoring
    client.on('serverHeartbeatFailed', (error) => {
      console.error('MongoDB server heartbeat failed:', error);
    });

    client.on('connectionPoolCleared', () => {
      console.warn('MongoDB connection pool cleared');
    });

    await client.connect();
    console.log('MongoDB connection established');
    return client;
  } catch (error) {
    console.error('Failed to initialize MongoDB client:', error);
    throw error;
  }
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = initializeClient();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = initializeClient();
}

async function getDb() {
  try {
    const _client = await clientPromise;
    const db = _client.db();
    
    // Basic connection validation
    if (!_client.topology || !_client.topology.isConnected()) {
      console.warn('MongoDB connection lost, reconnecting...');
      await _client.connect();
    }
    
    return db;
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
