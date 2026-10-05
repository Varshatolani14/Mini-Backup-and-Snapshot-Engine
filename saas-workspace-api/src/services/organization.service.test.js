'use strict';

jest.mock('../config/database', () => ({
  organizationMember: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  invitation: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn((promises) => Promise.all(promises)),
}));

jest.mock('../config', () => ({
  invitation: {
    expiresInDays: 7,
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../utils/email', () => ({
  sendInvitationEmail: jest.fn().mockResolvedValue({}),
}));

const prisma = require('../config/database');
const orgService = require('./organization.service');
const { sendInvitationEmail } = require('../utils/email');
const { NotFoundError } = require('../utils/errors');

describe('Organization Service - Soft Deletion and Invitation Bugs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserOrganizations', () => {
    it('should query only active organizations', async () => {
      prisma.organizationMember.findMany.mockResolvedValueOnce([]);
      prisma.organizationMember.count.mockResolvedValueOnce(0);

      await orgService.getUserOrganizations('user-1', { page: 1, limit: 10 });

      expect(prisma.organizationMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            organization: {
              isActive: true,
            },
          },
        })
      );
      expect(prisma.organizationMember.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organization: {
            isActive: true,
          },
        },
      });
    });
  });

  describe('inviteUser', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValueOnce(null); // no existing user with this email
      prisma.invitation.findFirst.mockResolvedValueOnce(null); // no pending invite
      prisma.invitation.create.mockResolvedValueOnce({
        id: 'inv-1',
        organizationId: 'org-1',
        email: 'new@example.com',
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        organization: { name: 'Acme Inc' },
        invitedBy: { firstName: 'A', lastName: 'B', email: 'admin@example.com' },
      });
    });

    it('should store a hashed token, never the raw token', async () => {
      await orgService.inviteUser('org-1', { email: 'new@example.com', role: 'MEMBER' }, 'admin-1');

      const createCall = prisma.invitation.create.mock.calls[0][0];
      expect(createCall.data.tokenHash).toBeDefined();
      expect(createCall.data.tokenHash).toHaveLength(64); // sha256 hex digest length
      expect(createCall.data).not.toHaveProperty('token');
    });

    it('should never return tokenHash in the created invitation', async () => {
      const result = await orgService.inviteUser(
        'org-1',
        { email: 'new@example.com', role: 'MEMBER' },
        'admin-1'
      );

      expect(result).not.toHaveProperty('tokenHash');
      expect(result).not.toHaveProperty('token');
    });

    it('should send the raw token only via email', async () => {
      await orgService.inviteUser('org-1', { email: 'new@example.com', role: 'MEMBER' }, 'admin-1');

      expect(sendInvitationEmail).toHaveBeenCalledWith(
        'new@example.com',
        expect.any(String),
        'Acme Inc'
      );

      const rawTokenSent = sendInvitationEmail.mock.calls[0][1];
      const hashedTokenStored = prisma.invitation.create.mock.calls[0][0].data.tokenHash;
      const crypto = require('crypto');
      expect(crypto.createHash('sha256').update(rawTokenSent).digest('hex')).toBe(hashedTokenStored);
    });

    it('should supersede an existing pending invitation instead of blocking the request', async () => {
      prisma.user.findUnique.mockReset().mockResolvedValueOnce(null);
      prisma.invitation.findFirst.mockReset().mockResolvedValueOnce({ id: 'old-inv' });

      await orgService.inviteUser('org-1', { email: 'new@example.com', role: 'MEMBER' }, 'admin-1');

      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'old-inv' },
        data: { status: 'EXPIRED' },
      });
      expect(prisma.invitation.create).toHaveBeenCalled();
    });
  });

  describe('acceptInvitation', () => {
    it('should hash the raw token before looking up the invitation', async () => {
      prisma.invitation.findUnique.mockResolvedValueOnce(null);

      await expect(orgService.acceptInvitation('raw-token-abc', 'user-1')).rejects.toThrow(
        NotFoundError
      );

      const crypto = require('crypto');
      const expectedHash = crypto.createHash('sha256').update('raw-token-abc').digest('hex');
      expect(prisma.invitation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: expectedHash } })
      );
    });

    it('should throw NotFoundError if the organization is soft-deleted', async () => {
      const mockInvitation = {
        id: 'inv-1',
        tokenHash: 'hash-abc',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
        organizationId: 'org-1',
        email: 'test@example.com',
        role: 'MEMBER',
        organization: {
          isActive: false,
        },
      };

      prisma.invitation.findUnique.mockResolvedValueOnce(mockInvitation);

      await expect(orgService.acceptInvitation('token-abc', 'user-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('cleanupExpiredInvitations', () => {
    it('should mark stale pending invitations as expired', async () => {
      prisma.invitation.updateMany.mockResolvedValueOnce({ count: 3 });

      const count = await orgService.cleanupExpiredInvitations();

      expect(prisma.invitation.updateMany).toHaveBeenCalledWith({
        where: { status: 'PENDING', expiresAt: { lt: expect.any(Date) } },
        data: { status: 'EXPIRED' },
      });
      expect(count).toBe(3);
    });
  });
});
