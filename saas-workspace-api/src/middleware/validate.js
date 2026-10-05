'use strict';

/**
 * src/middleware/validate.js
 *
 * Factory that creates Express middleware from a Joi schema.
 * Usage: router.post('/route', validate(mySchema), controller)
 *
 * On success, the validated (and coerced) value replaces req.body, req.query, or req.params.
 * WARNING: This middleware mutates the request object (req[source]) to ensure
 * downstream handlers use the sanitized/coerced values.
 * On failure, a 422 ValidationError is forwarded to the error handler.
 */

const { ValidationError } = require('../utils/errors');

/**
 * @param {import('joi').Schema} schema  - Joi schema to validate against
 * @param {'body'|'query'|'params'} [source='body'] - Which part of req to validate
 */
function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,    // Return all errors, not just the first
      stripUnknown: true,   // Remove extra fields silently
      convert: true,        // Type coercion (e.g. string → number)
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
        source,
      }));
      return next(new ValidationError(`Validation failed in ${source}`, details));
    }

    // Replace original data with the validated, sanitized, and coerced value.
    // Callers should be aware that req[source] (e.g., req.body) is mutated here.
    req[source] = value;
    return next();
  };
}

module.exports = validate;
