'use strict';

/**
 * src/controllers/project.controller.js
 */

const projectService = require('../services/project.service');
const { sendSuccess, paginationMeta } = require('../utils/response');

async function createProject(req, res, next) {
  try {
    const project = await projectService.createProject(req.body, req.params.orgId, req.user.id);
    return sendSuccess(res, project, 201);
  } catch (err) {
    return next(err);
  }
}

async function listProjects(req, res, next) {
  try {
    const { page, limit, status } = req.query;
    const { items, total } = await projectService.listProjects(req.params.orgId, { page, limit, status });
    return sendSuccess(res, items, 200, paginationMeta({ page, limit, total }));
  } catch (err) {
    return next(err);
  }
}

async function getProject(req, res, next) {
  try {
    const project = await projectService.getProjectById(req.params.projectId, req.params.orgId);
    return sendSuccess(res, project);
  } catch (err) {
    return next(err);
  }
}

async function updateProject(req, res, next) {
  try {
    const project = await projectService.updateProject(
      req.params.projectId, req.params.orgId, req.body, req.membership
    );
    return sendSuccess(res, project);
  } catch (err) {
    return next(err);
  }
}

async function deleteProject(req, res, next) {
  try {
    await projectService.deleteProject(req.params.projectId, req.params.orgId, req.membership);
    return sendSuccess(res, { message: 'Project deleted' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createProject, listProjects, getProject, updateProject, deleteProject };
