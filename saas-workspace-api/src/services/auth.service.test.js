'use strict';

jest.mock('../config/database', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
  },
}));

jest.mock('../config', () => ({
  bcrypt: { rounds: 4 },
  jwt: {
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  redis: { enabled: false },
  email: { verificationTokenExpiryHours: 24 },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../utils/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock('../utils/jwt', () => ({
  signAccessToken: jest.fn().mockReturnValue('access_token'),
  signRefreshToken: jest.fn().mockReturnValue('refresh_token'),
}));

const prisma = require('../config/database');
const authService = require('./auth.service');

describe('Auth Service - Email Normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('normalizes mixed-case and padded emails for duplicate check and create', async () => {
      const rawEmail = '   MiXeD-CaSe@ExAmPlE.cOm   ';
      const normalizedEmail = 'mixed-case@example.com';
      
      prisma.user.findUnique.mockResolvedValueOnce(null); // No existing user
      prisma.user.create.mockResolvedValueOnce({
        id: 'user-1',
        email: normalizedEmail,
        firstName: 'Jane',
        lastName: 'Doe',
        createdAt: new Date(),
      });

      await authService.signup({
        firstName: 'Jane',
        lastName: 'Doe',
        email: rawEmail,
        password: 'password123',
      });

      // Duplicate check uses normalized email
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: normalizedEmail },
      });

      // Create uses normalized email
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: normalizedEmail,
          }),
        })
      );
    });
  });

  describe('login', () => {
    it('normalizes mixed-case and padded emails for lookup', async () => {
      const rawEmail = '   MiXeD-CaSe@ExAmPlE.cOm   ';
      const normalizedEmail = 'mixed-case@example.com';

      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: normalizedEmail,
        passwordHash: 'hashed_password',
        isActive: true,
        isEmailVerified: true,
      });

      await authService.login({
        email: rawEmail,
        password: 'password123',
      });

      // Lookup uses normalized email
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: normalizedEmail },
      });
    });
  });
});
