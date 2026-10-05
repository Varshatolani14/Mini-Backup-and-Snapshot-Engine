'use strict';

/**
 * src/config/redis.js
 *
 * Exports a Redis client for token blacklisting and optional caching.
 * Redis is optional — if REDIS_ENABLED=false, all methods become no-ops
 * so the rest of the application doesn't need to handle the absence.
 */

const { createClient } = require('redis');
const config = require('./index');
const logger = require('../utils/logger');

let client = null;
let isConnected = false;

async function connect() {
  if (!config.redis.enabled) {
    logger.warn('REDIS_ENABLED=false: using in-memory blacklist (not multi-instance safe)');
    return;
  }

  client = createClient({ url: config.redis.url });

  client.on('error', (err) => logger.error({ err }, 'Redis client error'));
  client.on('connect', () => logger.info('Redis connected'));
  client.on('reconnecting', () => logger.warn('Redis reconnecting'));

  await client.connect();
  isConnected = true;
}

async function get(key) {
  if (!isConnected || !client) return null;
  return client.get(key);
}

async function set(key, value, ttlSeconds) {
  if (!isConnected || !client) return;
  await client.set(key, value, { EX: ttlSeconds });
}

async function del(key) {
  if (!isConnected || !client) return;
  await client.del(key);
}

async function exists(key) {
  if (!isConnected || !client) return false;
  const result = await client.exists(key);
  return result === 1;
}

async function disconnect() {
  if (client && isConnected) {
    await client.quit();
    isConnected = false;
  }
}

module.exports = { connect, get, set, del, exists, disconnect };
