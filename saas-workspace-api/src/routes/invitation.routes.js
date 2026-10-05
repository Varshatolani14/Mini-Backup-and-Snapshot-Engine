'use strict';

/**
 * src/routes/invitation.routes.js
 * Standalone route for accepting invitations via token.
 */

const express = require('express');
const router = express.Router();

const orgController = require('../controllers/organization.controller');
const authenticate = require('../middleware/authenticate');

/**
 * @openapi
 * /invitations/{token}/accept:
 *   post:
 *     tags: [Invitations]
 *     summary: Accept an organization invitation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *         description: The invitation token from the invite email
 *     responses:
 *       200:
 *         description: Invitation accepted, user added to org
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Wrong email or expired invitation
 *       404:
 *         description: Invitation not found
 */
router.post('/:token/accept', authenticate, orgController.acceptInvitation);

module.exports = router;
