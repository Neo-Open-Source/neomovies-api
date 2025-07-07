const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || process.env.mongodb_uri || process.env.MONGO_URI;

if (!uri) {
  throw new Error('MONGODB_URI environment variable is not set');
}

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

async function getDb() {
  const _client = await clientPromise;
  return _client.db();
}

module.exports = { getDb };
