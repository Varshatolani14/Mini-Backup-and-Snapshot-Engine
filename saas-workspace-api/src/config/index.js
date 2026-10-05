'use strict';

/**
 * src/config/index.js
 *
 * Central configuration module. Reads environment variables, validates
 * required values at startup, and exports a typed config object.
 * All application code imports from here — never from process.env directly.
 */

require('dotenv').config();

// ─── Helpers ─────────────────────────────────────────────────

function required(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

// JWT secrets specifically must also meet a minimum length: a short secret
// is brute-forceable, and `required()` alone would happily accept e.g. "x".
function requiredSecret(key, minLength = 32) {
  const val = required(key);
  if (val.length < minLength) {
    throw new Error(
      `${key} must be at least ${minLength} characters long (got ${val.length}). ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
    );
  }
  return val;
}

function optional(key, defaultValue) {
  return process.env[key] ?? defaultValue;
}

function optionalInt(key, defaultValue) {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
}

function optionalBool(key, defaultValue) {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val === 'true' || val === '1';
}

// ─── Config Object ────────────────────────────────────────────

const config = {
  env: optional('NODE_ENV', 'development'),
  isProduction: optional('NODE_ENV', 'development') === 'production',
  isDevelopment: optional('NODE_ENV', 'development') === 'development',

  server: {
    port: optionalInt('PORT', 3000),
    apiVersion: optional('API_VERSION', 'v1'),
  },

  database: {
    url: required('DATABASE_URL'),
  },

  jwt: {
    accessSecret: requiredSecret('JWT_ACCESS_SECRET'),
    refreshSecret: requiredSecret('JWT_REFRESH_SECRET'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  bcrypt: {
    rounds: optionalInt('BCRYPT_ROUNDS', 12),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
    enabled: optionalBool('REDIS_ENABLED', false),
  },

  rateLimit: {
    windowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 min
    maxRequests: optionalInt('RATE_LIMIT_MAX_REQUESTS', 100),
    authWindowMs: optionalInt('AUTH_RATE_LIMIT_WINDOW_MS', 5 * 60 * 1000), // 5 min
    authMaxRequests: optionalInt('AUTH_RATE_LIMIT_MAX', 5),
    // Per-account limiter on /login, keyed by the submitted email instead of
    // IP. Credential stuffing rotates source IPs but keeps hammering the
    // same account, so the IP-keyed authLimiter alone does not catch it.
    accountWindowMs: optionalInt('AUTH_ACCOUNT_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 min
    accountMaxRequests: optionalInt('AUTH_ACCOUNT_RATE_LIMIT_MAX', 10),
  },

  cors: {
    origins: optional('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
  },

  invitation: {
    expiresInDays: optionalInt('INVITATION_EXPIRES_IN_DAYS', 7),
    cleanupIntervalMs: optionalInt('INVITATION_CLEANUP_INTERVAL_MS', 60 * 60 * 1000), // 1 hour
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
    pretty: optionalBool('LOG_PRETTY', true),
  },

  email: {
    host: optional('EMAIL_HOST', ''),
    port: optionalInt('EMAIL_PORT', 587),
    user: optional('EMAIL_USER', ''),
    pass: optional('EMAIL_PASS', ''),
    from: optional('EMAIL_FROM', 'noreply@saasworkspace.com'),
    verificationTokenExpiryHours: optionalInt('EMAIL_VERIFICATION_EXPIRY_HOURS', 24)
  },

  app: {
    baseUrl: optional('APP_BASE_URL', 'http://localhost:3000'),
  }
};

if (config.isProduction) {
  const requiredMailConfig = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM', 'APP_BASE_URL'];
  const missingMailConfig = requiredMailConfig.filter((key) => !process.env[key]);

  if (missingMailConfig.length) {
    throw new Error(
      `Missing required production email configuration: ${missingMailConfig.join(', ')}`
    );
  }
}

module.exports = config;
