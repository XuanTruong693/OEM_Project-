const Redis = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
  retryStrategy: (times) => {
    // Only retry for 3 times, then give up to avoid hanging the app
    if (times > 3) {
      console.warn('⚠️ [Redis] Max retries reached. Falling back to local memory mode.');
      return null;
    }
    return Math.min(times * 100, 30000);
  },
  maxRetriesPerRequest: 10,
  enableOfflineQueue: true // Allow queuing commands during temporary reconnections
};

let pubClient = null;
let subClient = null;
let isRedisEnabled = false;

try {
  pubClient = new Redis(redisConfig);
  subClient = new Redis(redisConfig);

  pubClient.on('connect', () => {
    console.log('🚀 [Redis] Publisher connected successfully');
    isRedisEnabled = true;
  });

  pubClient.on('error', (err) => {
    console.warn('⚠️ [Redis] Connection error:', err.message);
    isRedisEnabled = false;
  });

  subClient.on('error', (err) => {
    console.warn('⚠️ [Redis] Subscribing error:', err.message);
  });
} catch (err) {
  console.warn('⚠️ [Redis] Initialization failed. Using local memory mode.');
}

module.exports = {
  pubClient,
  subClient,
  getIsRedisEnabled: () => isRedisEnabled,
  redisConfig
};
