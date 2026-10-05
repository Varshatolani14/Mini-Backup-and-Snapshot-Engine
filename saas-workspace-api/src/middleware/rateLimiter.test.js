'use strict';

/**
 * Isolated unit/integration tests for the rate limiter middleware.
 *
 * These build a minimal Express app around each limiter directly, so no
 * Prisma/Postgres connection is needed (unlike the supertest suites under
 * tests/, which exercise the full app against a real database).
 */

jest.mock('../config', () => ({
  rateLimit: {
    windowMs: 60_000,
    maxRequests: 100,
    authWindowMs: 60_000,
    authMaxRequests: 3,
    accountWindowMs: 60_000,
    accountMaxRequests: 2,
  },
}));

const express = require('express');
const request = require('supertest');
const { authLimiter, loginAccountLimiter } = require('./rateLimiter');

// Both limiters use skipSuccessfulRequests, so the test route simulates a
// failed login (401) — the exact case these limiters exist to throttle.
// A 200 response would not count against the limit at all.
function buildAuthLimiterApp() {
  const app = express();
  app.use(express.json());
  app.post('/login', authLimiter, (req, res) => res.status(401).json({ success: false }));
  return app;
}

function buildAccountLimiterApp() {
  const app = express();
  app.use(express.json());
  app.post('/login', loginAccountLimiter, (req, res) => res.status(401).json({ success: false }));
  return app;
}

describe('authLimiter', () => {
  it('allows failed attempts up to the configured max', async () => {
    const app = buildAuthLimiterApp();

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/login').send({});
      expect(res.status).toBe(401);
    }
  });

  it('blocks with 429 once the IP exceeds the configured max failed attempts', async () => {
    const app = buildAuthLimiterApp();

    for (let i = 0; i < 3; i++) {
      await request(app).post('/login').send({});
    }

    const res = await request(app).post('/login').send({});
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('returns standard RateLimit-* headers', async () => {
    const app = buildAuthLimiterApp();
    const res = await request(app).post('/login').send({});
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).toHaveProperty('ratelimit-remaining');
  });
});

describe('loginAccountLimiter', () => {
  it('rate limits per account, not per IP', async () => {
    const app = buildAccountLimiterApp();

    // Same IP (supertest uses one connection), two different accounts.
    // Each account gets its own bucket, so both should keep failing with
    // 401 (not yet rate-limited) even though the combined request count
    // exceeds a single account's max.
    const resA1 = await request(app).post('/login').send({ email: 'alice@example.com' });
    const resB1 = await request(app).post('/login').send({ email: 'bob@example.com' });
    const resA2 = await request(app).post('/login').send({ email: 'alice@example.com' });
    const resB2 = await request(app).post('/login').send({ email: 'bob@example.com' });

    expect(resA1.status).toBe(401);
    expect(resB1.status).toBe(401);
    expect(resA2.status).toBe(401);
    expect(resB2.status).toBe(401);
  });

  it('blocks with 429 once a single account exceeds its own max failed attempts', async () => {
    const app = buildAccountLimiterApp();
    const email = 'carol@example.com';

    await request(app).post('/login').send({ email });
    await request(app).post('/login').send({ email });
    const res = await request(app).post('/login').send({ email });

    expect(res.status).toBe(429);
    expect(res.body.error.message).toMatch(/this account/i);
  });

  it('normalizes email casing and whitespace into the same bucket', async () => {
    const app = buildAccountLimiterApp();

    await request(app).post('/login').send({ email: 'Dave@Example.com' });
    await request(app).post('/login').send({ email: '  dave@example.com  ' });
    const res = await request(app).post('/login').send({ email: 'dave@example.com' });

    expect(res.status).toBe(429);
  });

  it('falls back to a shared bucket instead of crashing when email is missing', async () => {
    const app = buildAccountLimiterApp();

    const res1 = await request(app).post('/login').send({});
    const res2 = await request(app).post('/login').send({});
    const res3 = await request(app).post('/login').send({});

    expect(res1.status).toBe(401);
    expect(res2.status).toBe(401);
    expect(res3.status).toBe(429);
  });
});
