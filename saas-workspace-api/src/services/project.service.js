'use strict';

/**
 * src/services/project.service.js
 *
 * Business logic for project management within organizations.
 * RBAC rules:
 *   - OWNER / ADMIN → full CRUD
 *   - MEMBER        → read-only
 */

const prisma = require('../config/database');
const { NotFoundError, AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

// ─── Create ───────────────────────────────────────────────────

async function createProject({ name, description, isPublic }, orgId, userId) {
  const project = await prisma.project.create({
    data: { name, description, isPublic, organizationId: orgId, createdByUserId: userId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  logger.info({ projectId: project.id, orgId, userId }, 'Project created');
  return project;
}

// ─── List ─────────────────────────────────────────────────────

async function listProjects(orgId, { page, limit, status }) {
  const skip = (page - 1) * limit;

  const where = { organizationId: orgId, ...(status && { status }) };

  const [projects, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return { items: projects, total };
}

// ─── Get One ──────────────────────────────────────────────────

async function getProjectById(projectId, orgId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      organization: { select: { id: true, name: true } },
    },
  });

  if (!project) throw new NotFoundError('Project');
  return project;
}

// ─── Update ───────────────────────────────────────────────────

async function updateProject(projectId, orgId, data, membership) {
  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: orgId } });
  if (!project) throw new NotFoundError('Project');

  if (membership.role === 'MEMBER') {
    throw new AuthorizationError('Members cannot update projects');
  }

  const updated = await prisma.project.update({ where: { id: projectId }, data });
  logger.info({ projectId, updatedBy: membership.userId }, 'Project updated');
  return updated;
}

// ─── Delete ───────────────────────────────────────────────────

async function deleteProject(projectId, orgId, membership) {
  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: orgId } });
  if (!project) throw new NotFoundError('Project');

  if (membership.role === 'MEMBER') {
    throw new AuthorizationError('Members cannot delete projects');
  }

  await prisma.project.delete({ where: { id: projectId } });
  logger.info({ projectId, deletedBy: membership.userId }, 'Project deleted');
}

module.exports = { createProject, listProjects, getProjectById, updateProject, deleteProject };
