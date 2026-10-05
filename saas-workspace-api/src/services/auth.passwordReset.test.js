'use strict';

const crypto = require('crypto');

jest.mock('../config/database', () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    updateMany: jest.fn(),
  },
}));

jest.mock('../config', () => ({
  bcrypt: { rounds: 4 },
  jwt: {
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  redis: { enabled: false },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../utils/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(),
}));

const prisma = require('../config/database');
const authService = require('./auth.service');
const { sendPasswordResetEmail } = require('../utils/email');
const { AuthenticationError } = require('../utils/errors');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

describe('Auth Service - Password Reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPasswordReset', () => {
    it('stores only a SHA-256 hash of the token, never the raw value', async () => {
      const user = { id: 'user-1', email: 'jane@example.com' };
      prisma.user.findUnique.mockResolvedValueOnce(user);
      prisma.user.update.mockResolvedValueOnce({});

      await authService.requestPasswordReset('jane@example.com');

      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.where).toEqual({ id: 'user-1' });
      expect(updateArgs.data.passwordResetToken).toMatch(/^[a-f0-9]{64}$/); // sha256 hex digest
      expect(updateArgs.data.passwordResetExpiry).toBeInstanceOf(Date);
    });

    it('sends the raw token (not the hash) in the email', async () => {
      const user = { id: 'user-1', email: 'jane@example.com' };
      prisma.user.findUnique.mockResolvedValueOnce(user);
      prisma.user.update.mockResolvedValueOnce({});

      await authService.requestPasswordReset('jane@example.com');

      // Let the fire-and-forget email promise settle.
      await new Promise((resolve) => setImmediate(resolve));

      expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const [toEmail, rawTokenSent] = sendPasswordResetEmail.mock.calls[0];
      expect(toEmail).toBe('jane@example.com');

      const storedHash = prisma.user.update.mock.calls[0][0].data.passwordResetToken;
      expect(sha256(rawTokenSent)).toBe(storedHash);
      expect(rawTokenSent).not.toBe(storedHash);
    });

    it('sets expiry to 1 hour from now', async () => {
      const user = { id: 'user-1', email: 'jane@example.com' };
      prisma.user.findUnique.mockResolvedValueOnce(user);
      prisma.user.update.mockResolvedValueOnce({});

      const before = Date.now();
      await authService.requestPasswordReset('jane@example.com');
      const after = Date.now();

      const expiry = prisma.user.update.mock.calls[0][0].data.passwordResetExpiry;
      const expectedMin = before + 60 * 60 * 1000 - 1000;
      const expectedMax = after + 60 * 60 * 1000 + 1000;
      expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(expiry.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('returns the same generic message for an unknown email (no enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const knownResult = { message: 'placeholder' };
      const user = { id: 'user-1', email: 'known@example.com' };
      prisma.user.findUnique.mockResolvedValueOnce(user);
      prisma.user.update.mockResolvedValueOnce({});

      const unknownResult = await authService.requestPasswordReset('unknown@example.com');
      knownResult.message = (await authService.requestPasswordReset('known@example.com')).message;

      expect(unknownResult.message).toBe(knownResult.message);
      expect(prisma.user.update).toHaveBeenCalledTimes(1); // only for the known user
    });
  });

  describe('resetPassword', () => {
    it('looks up the user by the hash of the provided token, not the raw token', async () => {
      const rawToken = 'a'.repeat(64);
      const hashedToken = sha256(rawToken);

      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        passwordResetToken: hashedToken,
        passwordResetExpiry: new Date(Date.now() + 60000),
      });
      prisma.user.update.mockResolvedValueOnce({});
      prisma.refreshToken.updateMany.mockResolvedValueOnce({});

      await authService.resetPassword(rawToken, 'NewSecurePass1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { passwordResetToken: hashedToken },
      });
    });

    it('throws for an unknown/invalid token', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(authService.resetPassword('bogus-token', 'NewSecurePass1')).rejects.toThrow(
        AuthenticationError
      );
    });

    it('throws for an expired token', async () => {
      const rawToken = 'b'.repeat(64);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        passwordResetToken: sha256(rawToken),
        passwordResetExpiry: new Date(Date.now() - 1000), // already expired
      });

      await expect(authService.resetPassword(rawToken, 'NewSecurePass1')).rejects.toThrow(
        'Reset token has expired'
      );
    });

    it('clears the token after a successful reset (single-use)', async () => {
      const rawToken = 'c'.repeat(64);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        passwordResetToken: sha256(rawToken),
        passwordResetExpiry: new Date(Date.now() + 60000),
      });
      prisma.user.update.mockResolvedValueOnce({});
      prisma.refreshToken.updateMany.mockResolvedValueOnce({});

      await authService.resetPassword(rawToken, 'NewSecurePass1');

      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data.passwordResetToken).toBeNull();
      expect(updateArgs.data.passwordResetExpiry).toBeNull();
      expect(updateArgs.data.passwordHash).toBeDefined();
    });

    it('revokes all active refresh tokens after a successful reset', async () => {
      const rawToken = 'd'.repeat(64);
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        passwordResetToken: sha256(rawToken),
        passwordResetExpiry: new Date(Date.now() + 60000),
      });
      prisma.user.update.mockResolvedValueOnce({});
      prisma.refreshToken.updateMany.mockResolvedValueOnce({});

      await authService.resetPassword(rawToken, 'NewSecurePass1');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
