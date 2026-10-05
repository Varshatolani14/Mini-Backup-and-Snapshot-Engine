'use strict';

/**
 * src/routes/auth.routes.js
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { authLimiter, loginAccountLimiter } = require('../middleware/rateLimiter');
const {
  signupSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/schemas');

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, password]
 *             properties:
 *               firstName: { type: string, example: "Jane" }
 *               lastName:  { type: string, example: "Doe" }
 *               email:     { type: string, format: email, example: "jane@example.com" }
 *               password:  { type: string, minLength: 8, example: "SecurePass1" }
 *     responses:
 *       201:
 *         description: User created with access and refresh tokens
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 user:
 *                   id: "clx123abc456"
 *                   firstName: "Jane"
 *                   lastName: "Doe"
 *                   email: "jane@example.com"
 *                   createdAt: "2026-07-20T10:30:00.000Z"
 *                 accessToken: "eyJhbGciOiJIUzI1NiIs..."
 *                 refreshToken: "eyJhbGciOiJIUzI1NiIs..."
 *       409:
 *         description: Email already in use
 *       422:
 *         description: Validation error
 */
router.post('/signup', authLimiter, validate(signupSchema), authController.signup);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and receive tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 user:
 *                   id: "clx123abc456"
 *                   firstName: "Jane"
 *                   lastName: "Doe"
 *                   email: "jane@example.com"
 *                 accessToken: "eyJhbGciOiJIUzI1NiIs..."
 *                 refreshToken: "eyJhbGciOiJIUzI1NiIs..."
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  authLimiter,
  loginAccountLimiter,
  validate(loginSchema),
  authController.login
);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token using a refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New token pair issued
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 accessToken: "eyJhbGciOiJIUzI1NiIs..."
 *                 refreshToken: "eyJhbGciOiJIUzI1NiIs..."
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', authLimiter, validate(refreshTokenSchema), authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out and revoke tokens
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get currently authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authenticate, authController.getMe);
/**
 * @openapi
 * /auth/verify-email/{token}:
 *   get:
 *     tags: [Auth]
 *     summary: Verify user's email address
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       404:
 *         description: Invalid verification token
 */
router.get('/verify-email/:token', authLimiter, authController.verifyEmail);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: >
 *           Generic success response is always returned, whether or not the
 *           email belongs to an account, to avoid leaking which emails are
 *           registered.
 *       422:
 *         description: Validation error
 */
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using a token from the reset email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:    { type: string, description: Raw reset token from the emailed link }
 *               password: { type: string, minLength: 8, example: "NewSecurePass1" }
 *     responses:
 *       200:
 *         description: Password reset successfully; all active sessions are revoked
 *       401:
 *         description: Invalid or expired reset token
 *       422:
 *         description: Validation error
 */
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

module.exports = router;
