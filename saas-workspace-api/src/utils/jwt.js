'use strict';


  // JWT helpers for signing and verifying access and refresh tokens.
  // Access tokens are short-lived (15 min) and carry the user identity.
  // Refresh tokens are long-lived (7 days) and are stored in the database
  // so they can be explicitly revoked on logout.
 

const jwt = require('jsonwebtoken');
const config = require('../config');
const { AuthenticationError } = require('./errors');

/**
 * Sign a new JWT access token.
 * @param {{ id, email, firstName, lastName }} payload
 * @returns {string} signed JWT
 */
function signAccessToken(payload) {
  return jwt.sign(
    {
      sub: payload.id,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

/**
 * Sign a new JWT refresh token.
 * @param {{ id }} payload
 * @returns {string} signed JWT
 */
function signRefreshToken(payload) {
  return jwt.sign({ sub: payload.id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}

/**
 * Verify and decode an access token.
 * Throws AuthenticationError on failure.
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthenticationError('Access token expired', 'TOKEN_EXPIRED');
    }
    throw new AuthenticationError('Invalid access token', 'TOKEN_INVALID');
  }
}

/**
 * Verify and decode a refresh token.
 * Throws AuthenticationError on failure.
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthenticationError('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
    }
    throw new AuthenticationError('Invalid refresh token', 'REFRESH_TOKEN_INVALID');
  }
}

/**
 * Extract a Bearer token from an Authorization header value.
 * @param {string} headerValue - e.g. "Bearer eyJhbGci..."
 * @returns {string|null}
 */
function extractBearerToken(headerValue) {
  if (!headerValue || !headerValue.startsWith('Bearer ')) return null;
  return headerValue.slice(7);
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, extractBearerToken };
