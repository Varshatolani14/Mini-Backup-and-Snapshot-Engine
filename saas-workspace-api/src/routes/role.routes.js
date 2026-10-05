'use strict';

/**
 * src/routes/role.routes.js
 *
 * Exposes a system-wide permission matrix endpoint to describe all available 
 * roles and capabilities. Useful for workspace administrators to review role 
 * permissions programmatically.
 */

const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const Joi = require('joi');

const searchPermissionsSchema = Joi.object({
  q: Joi.string().optional().allow(''),
});

// Require authentication for fetching roles/permissions matrix
router.use(authenticate);

/**
 * @openapi
 * /roles/permissions:
 *   get:
 *     tags: [Roles]
 *     summary: Get the role permission matrix
 *     description: Returns a matrix describing all available roles and capabilities, including custom roles support status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Optional search string to filter permissions
 *     responses:
 *       200:
 *         description: Role permission matrix
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name: { type: string }
 *                           description: { type: string }
 *                           isCustom: { type: boolean }
 *                           capabilities:
 *                             type: array
 *                             items: { type: string }
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           key: { type: string }
 *                           description: { type: string }
 *                     meta:
 *                       type: object
 *                       properties:
 *                         customRolesSupported: { type: boolean }
 */
router.get(
  '/permissions',
  validate(searchPermissionsSchema, 'query'),
  roleController.getPermissionMatrix
);

module.exports = router;
