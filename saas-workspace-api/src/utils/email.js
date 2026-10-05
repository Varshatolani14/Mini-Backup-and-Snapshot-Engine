'use strict';

/**
 * src/utils/email.js
 *
 * Email utility using Nodemailer.
 * In development: auto-creates an Ethereal test account (fake inbox you can view in browser).
 * In production: uses real SMTP credentials from env variables.
 */

const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('./logger');

// We store the transporter here so we only create it once
let transporter = null;

/**
 * Get or create the email transporter.
 * If no EMAIL_HOST is configured, we use Ethereal (a free test email service).
 */
async function getTransporter() {
  // If we already created one, reuse it
  if (transporter) return transporter;

  if (config.email.host) {
    // Production: use real SMTP server
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  } else {
    // Development: create a free Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.info('Using Ethereal test email account: %s', testAccount.user);
  }

  return transporter;
}

/**
 * Send a verification email to a new user.
 * @param {string} toEmail - The user's email address
 * @param {string} token - The verification token (UUID)
 */
async function sendVerificationEmail(toEmail, token) {
  const transport = await getTransporter();
  const verifyUrl = `${config.app.baseUrl}/api/v1/auth/verify-email/${token}`;

  const mailOptions = {
    from: config.email.from,
    to: toEmail,
    subject: 'Verify your email - SaaS Workspace',
    html: `
      <h1>Welcome to SaaS Workspace!</h1>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${verifyUrl}">Verify My Email</a>
      <p>This link expires in ${config.email.verificationTokenExpiryHours} hours.</p>
      <p>If you didn't sign up, you can ignore this email.</p>
    `,
  };

  const info = await transport.sendMail(mailOptions);

  // In development, log the URL where you can VIEW the sent email
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info('Preview verification email: %s', previewUrl);
  }

  return info;
}

/**
 * Send a password reset email.
 *
 * The raw token is only ever placed here, in the email — it is never
 * persisted anywhere. The server only ever stores its SHA-256 hash.
 *
 * @param {string} toEmail - The user's email address
 * @param {string} rawToken - The unhashed reset token
 */
async function sendPasswordResetEmail(toEmail, rawToken) {
  const transport = await getTransporter();
  const resetUrl = `${config.app.baseUrl}/reset-password?token=${rawToken}`;

  const mailOptions = {
    from: config.email.from,
    to: toEmail,
    subject: 'Reset your password - SaaS Workspace',
    html: `
      <h1>Password Reset Request</h1>
      <p>We received a request to reset your password. Click the link below to choose a new one:</p>
      <a href="${resetUrl}">Reset My Password</a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request a password reset, you can safely ignore this email — your password will not be changed.</p>
    `,
  };

  const info = await transport.sendMail(mailOptions);

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info('Preview password reset email: %s', previewUrl);
  }

  return info;
}

/**
 * Send a team invitation email.
 *
 * The raw token is only ever placed here, in the email — it is never
 * persisted anywhere. The server only ever stores its SHA-256 hash.
 *
 * @param {string} toEmail - The invitee's email address
 * @param {string} rawToken - The unhashed invitation token
 * @param {string} organizationName - Name of the organization they're invited to
 */
async function sendInvitationEmail(toEmail, rawToken, organizationName) {
  const transport = await getTransporter();
  const acceptUrl = `${config.app.baseUrl}/accept-invitation?token=${rawToken}`;

  const mailOptions = {
    from: config.email.from,
    to: toEmail,
    subject: `You've been invited to join ${organizationName} - SaaS Workspace`,
    html: `
      <h1>You're invited to join ${organizationName}</h1>
      <p>Click the link below to accept the invitation:</p>
      <a href="${acceptUrl}">Accept Invitation</a>
      <p>This link expires in ${config.invitation.expiresInDays} days.</p>
      <p>If you weren't expecting this invitation, you can ignore this email.</p>
    `,
  };

  const info = await transport.sendMail(mailOptions);

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    logger.info('Preview invitation email: %s', previewUrl);
  }

  return info;
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendInvitationEmail };
