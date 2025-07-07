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
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  retryWrites: true,
  w: 'majority',
  tlsAllowInvalidCertificates: true,
  heartbeatFrequencyMS: 10000,
  minHeartbeatFrequencyMS: 500,
  maxIdleTimeMS: 30000,
  waitQueueTimeoutMS: 30000
};

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, clientOptions);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, clientOptions);
  clientPromise = client.connect();
}

async function getDb() {
  const _client = await clientPromise;
  return _client.db();
}

async function closeConnection() {
  if (client) {
    await client.close();
  }
}

module.exports = { getDb, closeConnection };

process.on('SIGINT', async () => {
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});

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
