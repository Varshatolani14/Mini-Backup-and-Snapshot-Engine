'use strict';

/**
 * src/services/organization.service.js
 *
 * Business logic for organization management including:
 * - CRUD operations
 * - Member management
 * - Invitation system
 */

const crypto = require('crypto');
const prisma = require('../config/database');
const { generateUniqueSlug } = require('../utils/slug');
const { NotFoundError, ConflictError, AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');
const config = require('../config');
const { sendInvitationEmail } = require('../utils/email');

// Hash a raw invitation token for storage/lookup. Only this hash is ever
// persisted, the raw value is sent in the invitation email and never saved.
function hashInvitationToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// Fields safe to return from an invitation-returning endpoint. Never
// includes tokenHash, since that would defeat the purpose of hashing it.
const INVITATION_SAFE_SELECT = {
  id: true,
  organizationId: true,
  email: true,
  role: true,
  status: true,
  expiresAt: true,
  createdAt: true,
};

// ─── Create Organization ──────────────────────────────────────

async function createOrganization({ name, description }, ownerId) {
  const slug = generateUniqueSlug(name);

  // Use a transaction to create org + owner membership atomically
  const organization = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name, slug, description, ownerId },
    });

    // Owner is automatically added as a member with OWNER role
    await tx.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: ownerId,
        role: 'OWNER',
      },
    });

    return org;
  });

  logger.info({ orgId: organization.id, ownerId }, 'Organization created');
  return organization;
}

// ─── Get Organization ─────────────────────────────────────────

async function getOrganizationById(orgId) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId, isActive: true },
    include: {
      owner: {
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      },
      _count: { select: { members: true, projects: true } },
    },
  });

  if (!org) throw new NotFoundError('Organization');
  return org;
}

// ─── Get Organization by Slug ──────────────────────────────────

async function getOrganizationBySlug(slug) {
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      createdAt: true,
      isActive: true,
      owner: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
      _count: { select: { members: true, projects: true } },
    },
  });

  if (!org || !org.isActive) throw new NotFoundError('Organization');
  return org;
}

// ─── List User Organizations ──────────────────────────────────

async function getUserOrganizations(userId, { page, limit }) {
  const skip = (page - 1) * limit;

  const [memberships, total] = await prisma.$transaction([
    prisma.organizationMember.findMany({
      where: {
        userId,
        organization: {
          isActive: true,
        },
      },
      skip,
      take: limit,
      orderBy: { joinedAt: 'desc' },
      include: {
        organization: {
          include: {
            _count: { select: { members: true, projects: true } },
          },
        },
      },
    }),
    prisma.organizationMember.count({
      where: {
        userId,
        organization: {
          isActive: true,
        },
      },
    }),
  ]);

  return {
    items: memberships.map((m) => ({ ...m.organization, role: m.role, joinedAt: m.joinedAt })),
    total,
  };
}

// ─── Update Organization ──────────────────────────────────────

async function updateOrganization(orgId, data) {
  const org = await prisma.organization.update({
    where: { id: orgId },
    data,
  });
  logger.info({ orgId }, 'Organization updated');
  return org;
}

// ─── Delete Organization ──────────────────────────────────────

async function deleteOrganization(orgId, requestingUserId) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new NotFoundError('Organization');
  if (org.ownerId !== requestingUserId) {
    throw new AuthorizationError('Only the owner can delete an organization');
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { isActive: false },
  });

  logger.info({ orgId, requestingUserId }, 'Organization soft-deleted');
}

// ─── Members ──────────────────────────────────────────────────

async function getMembers(orgId, { page, limit, requesterRole }) {
  const skip = (page - 1) * limit;
  const isAdmin = ['OWNER', 'ADMIN'].includes(requesterRole);

  const userSelect = isAdmin
    ? { id: true, firstName: true, lastName: true, email: true, avatarUrl: true }
    : { id: true, firstName: true, lastName: true, avatarUrl: true };

  const [members, total] = await prisma.$transaction([
    prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      skip,
      take: limit,
      orderBy: { joinedAt: 'asc' },
      include: {
        user: { select: userSelect },
      },
    }),
    prisma.organizationMember.count({ where: { organizationId: orgId } }),
  ]);

  return { items: members, total };
}

async function updateMemberRole(orgId, targetUserId, newRole, requestingMembership) {
  // Cannot change your own role
  if (targetUserId === requestingMembership.userId) {
    throw new AuthorizationError('You cannot change your own role');
  }

  // Find the target membership
  const targetMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
  });

  if (!targetMembership) throw new NotFoundError('Member');

  // Owners cannot be demoted by anyone except themselves (ownership transfer not in scope)
  if (targetMembership.role === 'OWNER') {
    throw new AuthorizationError('The owner role cannot be changed');
  }

  // Admins can only manage MEMBERs, not other ADMINs
  if (requestingMembership.role === 'ADMIN' && targetMembership.role === 'ADMIN') {
    throw new AuthorizationError('Admins cannot change the role of other admins');
  }

  // Admins cannot promote to OWNER
  if (requestingMembership.role === 'ADMIN' && newRole === 'OWNER') {
    throw new AuthorizationError('Only owners can grant the owner role');
  }

  const updated = await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    data: { role: newRole },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  logger.info({ orgId, targetUserId, newRole }, 'Member role updated');
  return updated;
}

async function removeMember(orgId, targetUserId, requestingMembership) {
  if (targetUserId === requestingMembership.userId) {
    throw new AuthorizationError('Use the leave endpoint to remove yourself');
  }

  const target = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
  });

  if (!target) throw new NotFoundError('Member');
  if (target.role === 'OWNER') {
    throw new AuthorizationError('The owner cannot be removed from the organization');
  }

  // Admins can only remove MEMBERs
  if (requestingMembership.role === 'ADMIN' && target.role === 'ADMIN') {
    throw new AuthorizationError('Admins cannot remove other admins');
  }

  await prisma.organizationMember.delete({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
  });

  logger.info({ orgId, targetUserId }, 'Member removed from organization');
}

// ─── Invitations ─────────────────────────────────────────────

async function inviteUser(orgId, { email, role }, invitedByUserId) {
  // Check for existing active membership
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: existingUser.id },
      },
    });
    if (alreadyMember) {
      throw new ConflictError('This user is already a member of the organization');
    }
  }

  // Re-inviting the same email while a pending invitation exists supersedes
  // it: the old token is invalidated and a fresh one is issued, rather than
  // blocking the inviter or leaving two live tokens for the same invite.
  const pendingInvite = await prisma.invitation.findFirst({
    where: { organizationId: orgId, email, status: 'PENDING' },
  });
  if (pendingInvite) {
    await prisma.invitation.update({
      where: { id: pendingInvite.id },
      data: { status: 'EXPIRED' },
    });
    logger.info(
      { orgId, email, invitationId: pendingInvite.id },
      'Superseded pending invitation with a new one'
    );
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashInvitationToken(rawToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.invitation.expiresInDays);

  const invitation = await prisma.invitation.create({
    data: {
      organizationId: orgId,
      invitedByUserId,
      invitedUserId: existingUser?.id ?? null,
      email,
      role,
      tokenHash,
      expiresAt,
    },
    select: {
      ...INVITATION_SAFE_SELECT,
      organization: { select: { name: true } },
      invitedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  logger.info({ orgId, email, invitedByUserId }, 'Invitation created');

  // Fire-and-forget, same pattern as password reset: don't fail the
  // request if email delivery fails, and never persist the raw token.
  sendInvitationEmail(email, rawToken, invitation.organization.name).catch((err) =>
    logger.error({ err, orgId, email }, 'Failed to send invitation email')
  );

  return invitation;
}

async function acceptInvitation(rawToken, userId) {
  const tokenHash = hashInvitationToken(rawToken);

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: {
      organization: {
        select: { isActive: true },
      },
    },
  });

  if (!invitation || invitation.status !== 'PENDING' || !invitation.organization?.isActive) {
    throw new NotFoundError('Invitation');
  }

  if (invitation.expiresAt < new Date()) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
    throw new AuthorizationError('Invitation has expired');
  }

  // Confirm the accepting user's email matches the invitation
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user.email !== invitation.email) {
    throw new AuthorizationError('This invitation was sent to a different email address');
  }

  await prisma.$transaction([
    prisma.organizationMember.create({
      data: { organizationId: invitation.organizationId, userId, role: invitation.role },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', invitedUserId: userId },
    }),
  ]);

  logger.info({ invitationId: invitation.id, userId }, 'Invitation accepted');
  return { organizationId: invitation.organizationId };
}

// ─── Cleanup Expired Invitations ──────────────────────────────

// Marks any invitation still PENDING past its expiresAt as EXPIRED. Called
// on a schedule from server.js so stale invitations don't sit around
// indefinitely between accept attempts (which is the only other place
// expiry is checked).
async function cleanupExpiredInvitations() {
  const result = await prisma.invitation.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });

  if (result.count > 0) {
    logger.info({ count: result.count }, 'Expired stale pending invitations');
  }

  return result.count;
}

module.exports = {
  createOrganization,
  getOrganizationById,
  getOrganizationBySlug,
  getUserOrganizations,
  updateOrganization,
  deleteOrganization,
  getMembers,
  updateMemberRole,
  removeMember,
  inviteUser,
  acceptInvitation,
  cleanupExpiredInvitations,
};
