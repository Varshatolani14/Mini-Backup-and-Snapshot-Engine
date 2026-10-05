'use strict';

/**
 * src/controllers/organization.controller.js
 */

const orgService = require('../services/organization.service');
const { sendSuccess, paginationMeta } = require('../utils/response');

async function createOrganization(req, res, next) {
  try {
    const org = await orgService.createOrganization(req.body, req.user.id);
    return sendSuccess(res, org, 201);
  } catch (err) {
    return next(err);
  }
}

async function getOrganization(req, res, next) {
  try {
    const org = await orgService.getOrganizationById(req.params.orgId);
    return sendSuccess(res, org);
  } catch (err) {
    return next(err);
  }
}

async function getOrganizationBySlug(req, res, next) {
  try {
    const org = await orgService.getOrganizationBySlug(req.params.slug);
    return sendSuccess(res, org);
  } catch (err) {
    return next(err);
  }
}

async function listMyOrganizations(req, res, next) {
  try {
    const { page, limit } = req.query;
    const { items, total } = await orgService.getUserOrganizations(req.user.id, { page, limit });
    return sendSuccess(res, items, 200, paginationMeta({ page, limit, total }));
  } catch (err) {
    return next(err);
  }
}

async function updateOrganization(req, res, next) {
  try {
    const org = await orgService.updateOrganization(req.params.orgId, req.body);
    return sendSuccess(res, org);
  } catch (err) {
    return next(err);
  }
}

async function deleteOrganization(req, res, next) {
  try {
    await orgService.deleteOrganization(req.params.orgId, req.user.id);
    return sendSuccess(res, { message: 'Organization deleted' });
  } catch (err) {
    return next(err);
  }
}

async function getMembers(req, res, next) {
  try {
    const { page, limit } = req.query;
    const requesterRole = req.membership?.role;
    const { items, total } = await orgService.getMembers(req.params.orgId, { page, limit, requesterRole });
    return sendSuccess(res, items, 200, paginationMeta({ page, limit, total }));
  } catch (err) {
    return next(err);
  }
}

async function updateMemberRole(req, res, next) {
  try {
    const { orgId, userId } = req.params;
    const updated = await orgService.updateMemberRole(orgId, userId, req.body.role, req.membership);
    return sendSuccess(res, updated);
  } catch (err) {
    return next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    const { orgId, userId } = req.params;
    await orgService.removeMember(orgId, userId, req.membership);
    return sendSuccess(res, { message: 'Member removed' });
  } catch (err) {
    return next(err);
  }
}

async function inviteUser(req, res, next) {
  try {
    const invitation = await orgService.inviteUser(req.params.orgId, req.body, req.user.id);
    return sendSuccess(res, invitation, 201);
  } catch (err) {
    return next(err);
  }
}

async function acceptInvitation(req, res, next) {
  try {
    const result = await orgService.acceptInvitation(req.params.token, req.user.id);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createOrganization,
  getOrganization,
  getOrganizationBySlug,
  listMyOrganizations,
  updateOrganization,
  deleteOrganization,
  getMembers,
  updateMemberRole,
  removeMember,
  inviteUser,
  acceptInvitation,
};
