const { createClient } = require('redis');

let client = null;

function getRedisClient() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = createClient({ url });
  client.on('error', (err) => console.error('Redis Client Error', err));
  client.connect().catch((e) => console.warn('Redis connect failed:', e.message));
  return client;
}

module.exports = { getRedisClient };


