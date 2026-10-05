'use strict';

/**
 * 
 *
 * Standardised API response envelope helpers.
 * All controllers use these to ensure a consistent response shape:
 *
 *   Success: { success: true, data: {...}, meta?: {...} }
 *   Error:   { success: false, error: { message, code, details? } }
 */

/**
 * Send a successful JSON response.
 * @param {Response} res  - Express response object
 * @param {*}        data - Payload to send under the `data` key
 * @param {number}   [statusCode=200]
 * @param {object}   [meta] - Optional pagination/metadata
 */
function sendSuccess(res, data, statusCode = 200, meta = null) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

/**
 * Build a pagination meta object for list endpoints.
 */
function paginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = { sendSuccess, paginationMeta };
