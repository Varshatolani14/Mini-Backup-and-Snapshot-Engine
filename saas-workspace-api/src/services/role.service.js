'use strict';

/**
 * src/services/role.service.js
 *
 * Provides the static role and permission definitions for the workspace.
 */

const PERMISSIONS = [
  { key: 'org:read', description: 'View organization details' },
  { key: 'org:update', description: 'Update organization settings' },
  { key: 'org:delete', description: 'Delete the entire organization' },
  { key: 'member:read', description: 'View organization members' },
  { key: 'member:invite', description: 'Invite new members to the organization' },
  { key: 'member:remove', description: 'Remove members from the organization' },
  { key: 'role:update', description: 'Change the role of organization members' },
  { key: 'project:read', description: 'View projects within the organization' },
  { key: 'project:create', description: 'Create new projects' },
  { key: 'project:update', description: 'Update existing projects' },
  { key: 'project:delete', description: 'Delete projects' },
];

const ROLES = [
  {
    name: 'OWNER',
    description: 'Full access to all organization resources and settings.',
    isCustom: false,
    capabilities: [
      'org:read',
      'org:update',
      'org:delete',
      'member:read',
      'member:invite',
      'member:remove',
      'role:update',
      'project:read',
      'project:create',
      'project:update',
      'project:delete',
    ],
  },
  {
    name: 'ADMIN',
    description: 'Administrative access to manage members and projects.',
    isCustom: false,
    capabilities: [
      'org:read',
      'org:update',
      'member:read',
      'member:invite',
      'member:remove',
      'role:update',
      'project:read',
      'project:create',
      'project:update',
      'project:delete',
    ],
  },
  {
    name: 'MEMBER',
    description: 'Standard access to view the organization and participate in projects.',
    isCustom: false,
    capabilities: [
      'org:read',
      'member:read',
      'project:read',
    ],
  },
];

/**
 * Get the permission matrix.
 *
 * @param {Object} options
 * @param {string} [options.query] - Optional search string to filter permissions
 * @returns {Object} Matrix containing roles and permissions
 */
function getPermissionMatrix({ query } = {}) {
  let filteredPermissions = PERMISSIONS;

  if (query) {
    const lowerQuery = query.toLowerCase();
    filteredPermissions = PERMISSIONS.filter(
      (p) => p.key.toLowerCase().includes(lowerQuery) || p.description.toLowerCase().includes(lowerQuery)
    );
  }

  return {
    roles: ROLES,
    permissions: filteredPermissions,
    meta: {
      customRolesSupported: false,
    },
  };
}

module.exports = {
  PERMISSIONS,
  ROLES,
  getPermissionMatrix,
};
