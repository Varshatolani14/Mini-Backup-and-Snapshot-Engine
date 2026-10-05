'use strict';

/**
 * src/middleware/rbac.js
 *
 * Role-Based Access Control (RBAC) middleware.
 *
 * This module provides two things:
 *   1. `requireOrgMembership` — loads the calling user's membership record
 *      for the target organization and attaches it to req.membership.
 *   2. `requireRole(...roles)` — factory that creates middleware to gate
 *      a route to users with one of the specified roles.
 *
 * Role hierarchy (highest → lowest):
 *   OWNER > ADMIN > MEMBER
 *
 * Usage example:
 *   router.delete(
 *     '/organizations/:orgId/members/:userId',
 *     authenticate,
 *     requireOrgMembership,
 *     requireRole('OWNER', 'ADMIN'),
 *     controller.removeMember,
 *   );
 */

const prisma = require('../config/database');
const { AuthorizationError, NotFoundError } = require('../utils/errors');

// Numeric weight per role — higher = more privileged
const ROLE_WEIGHT = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

/**
 * Middleware: Load the authenticated user's membership in the org from the
 * route parameter `orgId`. Attaches the membership to req.membership.
 * Throws 404 if the org doesn't exist, 403 if the user isn't a member.
 */
async function requireOrgMembership(req, _res, next) {
  try {
    const { orgId } = req.params;

    // Verify the organization exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, ownerId: true, isActive: true },
    });

    if (!org || !org.isActive) throw new NotFoundError('Organization');

    // Load membership
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      throw new AuthorizationError('You are not a member of this organization');
    }

    req.organization = org;
    req.membership = membership;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Middleware factory: restrict access to users with one of the given roles.
 * Must be used AFTER requireOrgMembership (which populates req.membership).
 *
 * @param {...string} allowedRoles - e.g. requireRole('OWNER', 'ADMIN')
 */
function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    const userRole = req.membership?.role;

    if (!userRole) {
      const orgId = req.params?.orgId || 'missing';
      const userId = req.user?.id || 'missing';
      return next(new AuthorizationError(`Membership not loaded. Use requireOrgMembership first. Context: orgId=${orgId}, userId=${userId}`));
    }

    if (!allowedRoles.includes(userRole)) {
      return next(
        new AuthorizationError(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`
        )
      );
    }

    return next();
  };
}

/**
 * Convenience: check if a role has AT LEAST the minimum weight of another role.
 * Useful in service layer checks.
 */
function hasMinimumRole(userRole, minimumRole) {
  return (ROLE_WEIGHT[userRole] ?? 0) >= (ROLE_WEIGHT[minimumRole] ?? 0);
}

module.exports = { requireOrgMembership, requireRole, hasMinimumRole };
