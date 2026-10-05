'use strict';

/**
 * 
 *
 * Pino structured logger — the single logging instance for the app.
 *
 * In development: pretty-printed human-readable output.
 * In production: JSON lines suitable for log aggregators (Datadog, CloudWatch, etc.)
 */

const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: config.logging.level,
  // Redact sensitive fields from all log output
  redact: {
    paths: ['req.headers.authorization', 'body.password', 'body.passwordHash'],
    censor: '[REDACTED]',
  },
  transport: config.logging.pretty
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Base fields added to every log line
  base: {
    service: 'saas-workspace-api',
    env: config.env,
  },

  // ISO timestamp
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
