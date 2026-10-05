'use strict';

const { getPermissionMatrix, ROLES, PERMISSIONS } = require('./role.service');

describe('Role Service', () => {
  describe('getPermissionMatrix', () => {
    it('should return all roles and permissions when no query is provided', () => {
      const matrix = getPermissionMatrix();
      
      expect(matrix.roles).toEqual(ROLES);
      expect(matrix.permissions).toEqual(PERMISSIONS);
      expect(matrix.meta.customRolesSupported).toBe(false);
    });

    it('should filter permissions based on query', () => {
      const matrix = getPermissionMatrix({ query: 'invite' });
      
      expect(matrix.permissions).toHaveLength(1);
      expect(matrix.permissions[0].key).toBe('member:invite');
    });

    it('should filter permissions based on query case-insensitively', () => {
      const matrix = getPermissionMatrix({ query: 'INVITE' });
      
      expect(matrix.permissions).toHaveLength(1);
      expect(matrix.permissions[0].key).toBe('member:invite');
    });

    it('should return empty permissions array if no match is found', () => {
      const matrix = getPermissionMatrix({ query: 'nonexistentpermission' });
      
      expect(matrix.permissions).toHaveLength(0);
    });
  });
});
