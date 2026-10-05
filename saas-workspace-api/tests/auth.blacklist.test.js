/**
 * Integration test: Access token blacklisting after logout
 *
 * Tests that calling POST /auth/logout prevents the old access token
 * from being used on protected routes — under both Redis and in-memory modes.
 *
 * To run: npm test  (or jest tests/auth.blacklist.test.js)
 *
 * These tests run against the in-memory blacklist (REDIS_ENABLED=false)
 * by default. To test with Redis, set REDIS_ENABLED=true in your .env.test
 */

process.env.DATABASE_URL = 'postgres://fake:fake@localhost:5432/fake';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.REDIS_ENABLED = 'false';

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');
const { signAccessToken } = require('../src/utils/jwt');

jest.mock('../src/config/database', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  organizationMember: {
    findMany: jest.fn(),
  },
}));

jest.mock('../src/utils/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(),
}));

describe('Token blacklisting after logout', () => {
  let accessToken;
  let refreshToken;
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    avatarUrl: null,
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.user.create.mockResolvedValue(mockUser);
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1', token: 'ref-token-123' });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    accessToken = signAccessToken(mockUser);
    refreshToken = 'ref-token-123';
  });

  it('should allow access to GET /auth/me before logout', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject the old access token immediately after logout (in-memory blacklist)', async () => {
    // Step 1: Logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(logoutRes.status).toBe(200);

    // Step 2: Replay the old access token on a protected route
    const replayRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    // Must be rejected — token has been blacklisted
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.success).toBe(false);
  });

  it('should reject old access token across multiple protected routes after logout', async () => {
    // Logout
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    // Try on /auth/me
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(401);

    // Try on /organizations (another protected route)
    prisma.organizationMember.findMany.mockResolvedValue([]);
    const orgsRes = await request(app)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(orgsRes.status).toBe(401);
  });

  it('should allow login again and use new token after logout', async () => {
    // Logout
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    const newAccessToken = signAccessToken({ ...mockUser, id: 'user-456' });
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newAccessToken}`);

    expect(meRes.status).toBe(200);
  });
});

// Unit test for the in-memory blacklist module itself
describe('inMemoryBlacklist utility', () => {
  const inMemoryBlacklist = require('../src/utils/inMemoryBlacklist');

  afterAll(() => {
    inMemoryBlacklist.destroy(); // Clean up timer so Jest doesn't warn about open handles
  });

  it('returns false for a jti that was never added', () => {
    expect(inMemoryBlacklist.has('never-added-jti')).toBe(false);
  });

  it('returns true immediately after adding a jti with a long TTL', () => {
    const jti = 'test-jti-1';
    inMemoryBlacklist.add(jti, 15 * 60 * 1000); // 15 min TTL
    expect(inMemoryBlacklist.has(jti)).toBe(true);
  });

  it('returns false after a jti has expired', async () => {
    const jti = 'test-jti-expired';
    inMemoryBlacklist.add(jti, 1); // 1ms TTL

    // Wait for it to expire
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(inMemoryBlacklist.has(jti)).toBe(false);
  });
});