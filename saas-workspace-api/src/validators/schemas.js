'use strict';

/**
 * src/validators/schemas.js
 *
 * Joi validation schemas for all incoming request bodies and query params.
 * Keeping schemas in one place makes them reusable and easy to audit.
 */

const Joi = require('joi');

// ─── Auth ─────────────────────────────────────────────────────

const signupSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(50).required(),
  lastName: Joi.string().trim().min(1).max(50).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    }),
});

// ─── Organizations ────────────────────────────────────────────

const createOrgSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(500).optional().allow(''),
});

const updateOrgSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  description: Joi.string().trim().max(500).optional().allow(''),
}).min(1);

const inviteUserSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  role: Joi.string().valid('ADMIN', 'MEMBER').default('MEMBER'),
});

const updateMemberRoleSchema = Joi.object({
  role: Joi.string().valid('ADMIN', 'MEMBER').required(),
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// ─── Projects ─────────────────────────────────────────────────

const listProjectsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('ACTIVE', 'ARCHIVED', 'COMPLETED').optional(),
});

const createProjectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  isPublic: Joi.boolean().default(false),
});

const updateProjectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  status: Joi.string().valid('ACTIVE', 'ARCHIVED', 'COMPLETED').optional(),
  isPublic: Joi.boolean().optional(),
}).min(1);

module.exports = {
  signupSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createOrgSchema,
  updateOrgSchema,
  inviteUserSchema,
  updateMemberRoleSchema,
  paginationSchema,
  listProjectsSchema,
  createProjectSchema,
  updateProjectSchema,
};
