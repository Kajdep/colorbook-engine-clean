const Joi = require('joi');

// Request validation middleware
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        error: 'Validation Error',
        message: 'Request validation failed',
        details: errors
      });
    }

    // Replace original request data with validated data
    req[property] = value;
    next();
  };
};

// Query parameter validation
const validateQuery = (schema) => {
  return validateRequest(schema, 'query');
};

// URL parameter validation
const validateParams = (schema) => {
  return validateRequest(schema, 'params');
};

// Common validation schemas
const commonSchemas = {
  uuid: Joi.string().uuid().required(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().default('created_at'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC')
  }),
  search: Joi.object({
    q: Joi.string().max(255).optional(),
    category: Joi.string().max(100).optional(),
    status: Joi.string().valid('draft', 'published', 'archived').optional()
  })
};

module.exports = {
  validateRequest,
  validateQuery,
  validateParams,
  commonSchemas
};