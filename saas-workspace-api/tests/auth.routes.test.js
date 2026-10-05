'use strict';

process.env.DATABASE_URL = 'postgres://fake:fake@localhost:5432/fake';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.REDIS_ENABLED = 'false';

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');
const bcrypt = require('bcryptjs');

// Mock prisma
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
}));

jest.mock('../src/utils/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(),
}));

describe('Auth Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/signup', () => {
    it('should successfully register a new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        createdAt: new Date(),
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should fail with 409 if user already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-123' });

      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('should fail validation with 422 if missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'not-an-email',
          password: '123',
        });

      expect(response.status).toBe(422);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should successfully login and return tokens', async () => {
      const passwordHash = await bcrypt.hash('Password123!', 1);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash,
        isActive: true,
        isEmailVerified: true,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should fail with 401 on invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword!',
        });

      expect(response.status).toBe(401);
    });

    it('should fail with 401 if email not verified', async () => {
      const passwordHash = await bcrypt.hash('Password123!', 1);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash,
        isActive: true,
        isEmailVerified: false,
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toMatch(/verify your email/i);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should successfully refresh token', async () => {
      const jwt = require('jsonwebtoken');
      const validRefreshToken = jwt.sign({ id: 'user-123' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-123',
        token: validRefreshToken,
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
        user: { id: 'user-123', isActive: true },
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: validRefreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should fail with 401 if refresh token is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should successfully logout', async () => {
      const jwt = require('jsonwebtoken');
      const accessToken = jwt.sign({ id: 'user-123' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

      prisma.refreshToken.updateMany.mockResolvedValue({});

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          refreshToken: 'dummy-refresh-token',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('should fail with 401 if missing auth header', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({
          refreshToken: 'dummy-refresh-token',
        });

      expect(response.status).toBe(401);
    });
  });
});
