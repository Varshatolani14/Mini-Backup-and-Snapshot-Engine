'use strict';

/**
 * src/middleware/rateLimiter.js
 *
 * Three rate limiters:
 *   - `apiLimiter`         : General limiter applied to all routes
 *   - `authLimiter`        : Stricter, IP-keyed limiter for auth endpoints
 *                             to slow brute-force
 *   - `loginAccountLimiter`: Per-account (email-keyed) limiter on /login,
 *                             to catch credential stuffing that rotates
 *                             source IPs while targeting the same account
 *
 * Uses in-memory store by default. For multi-instance deployments,
 * swap to redis store: npm install rate-limit-redis
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,  // Return `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMITED',
    },
  },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMaxRequests, // Much stricter for auth
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again later',
      code: 'RATE_LIMITED',
    },
  },
  skipSuccessfulRequests: true, // Only count failed auth attempts
});

// Normalizes the submitted email into a stable rate-limit key. Falls back to
// a fixed key when the body has no usable email yet (e.g. malformed JSON),
// so unauthenticated requests still share a bucket instead of bypassing the
// limiter entirely.
function loginAccountKey(req) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return email || 'unknown-account';
}

const loginAccountLimiter = rateLimit({
  windowMs: config.rateLimit.accountWindowMs,
  max: config.rateLimit.accountMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: loginAccountKey,
  message: {
    success: false,
    error: {
      message: 'Too many login attempts for this account, please try again later',
      code: 'RATE_LIMITED',
    },
  },
  skipSuccessfulRequests: true, // Only count failed login attempts
});

module.exports = { apiLimiter, authLimiter, loginAccountLimiter };
