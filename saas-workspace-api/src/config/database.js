'use strict';

/**
 * src/config/database.js
 *
 * Exports a singleton PrismaClient instance.
 * Using a singleton prevents "too many connections" issues
 * in development with hot-reload (nodemon), and ensures a
 * single connection pool across the entire application.
 */

const { PrismaClient } = require('@prisma/client');
const config = require('./index');
const logger = require('../utils/logger');

// Attach Prisma's query event only in development for debugging
const prisma = new PrismaClient({
  log: config.isDevelopment
    ? [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ]
    : [{ emit: 'event', level: 'error' }],
});

// Log slow queries in development
if (config.isDevelopment) {
  prisma.$on('query', (e) => {
    if (e.duration > 200) {
      logger.warn({ duration: e.duration, query: e.query }, 'Slow Prisma query');
    }
  });
}

prisma.$on('error', (e) => {
  logger.error({ message: e.message }, 'Prisma error');
});

module.exports = prisma;
