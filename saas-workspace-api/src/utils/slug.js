'use strict';

/**
 * src/utils/slug.js
 * Generates URL-safe slugs for organization names.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Convert a string to a URL-safe slug.
 * e.g. "My Cool Org!" → "my-cool-org"
 */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // Remove non-word chars
    .replace(/[\s_-]+/g, '-')  // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, '');  // Trim leading/trailing hyphens
}

/**
 * Generate a unique slug by appending a short UUID segment if needed.
 */
function generateUniqueSlug(name) {
  const base = slugify(name);
  const suffix = uuidv4().split('-')[0]; // 8-char suffix
  return `${base}-${suffix}`;
}

module.exports = { slugify, generateUniqueSlug };
