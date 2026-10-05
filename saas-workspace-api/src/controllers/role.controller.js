'use strict';

/**
 * src/controllers/role.controller.js
 */

const roleService = require('../services/role.service');

/**
 * Get the permission matrix and role definitions.
 * Optional query parameter `q` can be used to search/filter permissions.
 */
async function getPermissionMatrix(req, res, next) {
  try {
    const { q } = req.query;
    
    const matrix = roleService.getPermissionMatrix({ query: q });
    
    res.json({
      success: true,
      data: matrix,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPermissionMatrix,
};
