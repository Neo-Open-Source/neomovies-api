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
  // Увеличиваем таймауты для медленных соединений
  serverSelectionTimeoutMS: 60000, // 60 секунд
  socketTimeoutMS: 0, // Убираем таймаут сокета
  connectTimeoutMS: 60000, // 60 секунд
  retryWrites: true,
  w: 'majority',
  
  // Добавляем настройки для лучшей стабильности
  maxIdleTimeMS: 30000,
  waitQueueTimeoutMS: 5000,
  heartbeatFrequencyMS: 10000,
  
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true
  }
};

// Функция для создания подключения с retry логикой
async function createConnection() {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      console.log(`Attempting to connect to MongoDB (attempt ${attempts + 1}/${maxAttempts})...`);
      const client = new MongoClient(uri, clientOptions);
      await client.connect();
      
      // Проверяем подключение
      await client.db().admin().ping();
      console.log('MongoDB connection successful');
      return client;
      
    } catch (error) {
      attempts++;
      console.error(`Connection attempt ${attempts} failed:`, error.message);
      
      if (attempts >= maxAttempts) {
        throw new Error(`Failed to connect to MongoDB after ${maxAttempts} attempts: ${error.message}`);
      }
      
      // Ждем перед следующей попыткой
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Connection management
if (process.env.NODE_ENV === 'development') {
  // В режиме разработки используем глобальную переменную
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = createConnection();
    console.log('MongoDB connection initialized in development');
  }
  clientPromise = global._mongoClientPromise;
} else {
  // В продакшене создаем новое подключение
  clientPromise = createConnection();
  console.log('MongoDB connection initialized in production');
}

async function getDb() {
  try {
    const mongoClient = await clientPromise;
    
    // Проверяем, что подключение все еще активно
    if (!mongoClient || mongoClient.topology.isDestroyed()) {
      throw new Error('MongoDB connection is not available');
    }
    
    return mongoClient.db();
  } catch (error) {
    console.error('Error getting MongoDB database:', error);
    
    // Пытаемся переподключиться
    console.log('Attempting to reconnect...');
    if (process.env.NODE_ENV === 'development') {
      global._mongoClientPromise = createConnection();
      clientPromise = global._mongoClientPromise;
    } else {
      clientPromise = createConnection();
    }
    
    const mongoClient = await clientPromise;
    return mongoClient.db();
  }
}

async function closeConnection() {
  try {
    const mongoClient = await clientPromise;
    if (mongoClient) {
      await mongoClient.close(true);
      console.log('MongoDB connection closed');
    }
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  } finally {
    client = null;
    if (process.env.NODE_ENV === 'development') {
      global._mongoClientPromise = null;
    }
  }
}

// Функция для проверки подключения
async function checkConnection() {
  try {
    const db = await getDb();
    await db.admin().ping();
    console.log('MongoDB connection is healthy');
    return true;
  } catch (error) {
    console.error('MongoDB connection check failed:', error.message);
    return false;
  }
}

// Clean up handlers
const cleanup = async () => {
  console.log('Cleaning up MongoDB connection...');
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

module.exports = { getDb, closeConnection, checkConnection };