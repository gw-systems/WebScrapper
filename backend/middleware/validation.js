/**
 * Input Validation Middleware
 * Provides Joi schemas and validation functions for all user inputs
 */

const Joi = require('joi');
const logger = require('../utils/logger');

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * WebSocket Message Schemas
 */
const wsMessageSchemas = {
    // Base message schema
    base: Joi.object({
        action: Joi.string().valid('initialize', 'setLocation', 'search', 'scrapeCategories', 'close-browser').required(),
        service: Joi.string().valid('zepto', 'blinkit').optional(),
    }),

    // Initialize browser
    initialize: Joi.object({
        action: Joi.string().valid('initialize').required(),
        service: Joi.string().valid('zepto', 'blinkit').required(),
    }),

    // Set location
    setLocation: Joi.object({
        action: Joi.string().valid('setLocation').required(),
        service: Joi.string().valid('zepto', 'blinkit').optional(),
        location: Joi.string()
            .trim()
            .min(2)
            .max(200)
            .pattern(/^[a-zA-Z0-9\s,.-]+$/)
            .required()
            .messages({
                'string.pattern.base': 'Location contains invalid characters',
                'string.min': 'Location must be at least 2 characters',
                'string.max': 'Location must not exceed 200 characters'
            })
    }),

    // Search products
    search: Joi.object({
        action: Joi.string().valid('search').required(),
        service: Joi.string().valid('zepto', 'blinkit').required(),
        query: Joi.string()
            .trim()
            .min(1)
            .max(100)
            .required()
            .messages({
                'string.min': 'Search query cannot be empty',
                'string.max': 'Search query must not exceed 100 characters'
            })
    }),

    // Scrape categories
    scrapeCategories: Joi.object({
        action: Joi.string().valid('scrapeCategories').required(),
        service: Joi.string().valid('zepto', 'blinkit').required(),
        categoryFilter: Joi.string().allow('').optional(),
        maxCategories: Joi.number().optional(),
        excludedCategories: Joi.array().items(Joi.string()).optional(),
        // categories array is optional since backend can fetch them
        categories: Joi.array().items(Joi.object({
            name: Joi.string().required(),
            url: Joi.string().uri().required(),
            mainCategory: Joi.string().optional(),
            subCategory: Joi.string().optional(),
        })).optional()
    }),

    // Close browser
    closeBrowser: Joi.object({
        action: Joi.string().valid('close-browser').required(),
        service: Joi.string().valid('zepto', 'blinkit').required(),
    })
};

/**
 * API Endpoint Schemas
 */
const apiSchemas = {
    // GET /api/instamart/products query parameters
    productsQuery: Joi.object({
        category: Joi.string().trim().max(200).optional(),
        search: Joi.string().trim().max(100).optional(),
        inStock: Joi.string().valid('true', 'false').optional(),
        limit: Joi.number().integer().min(1).max(1000).default(50),
        offset: Joi.number().integer().min(0).default(0)
    }),

    // POST /api/instamart/scrape body
    scrapeBody: Joi.object({
        category: Joi.string()
            .trim()
            .min(1)
            .max(200)
            .required()
            .messages({
                'string.empty': 'Category is required',
                'string.max': 'Category name too long'
            })
    })
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate WebSocket message
 * @param {Object} message - The message object to validate
 * @returns {Object} { valid: boolean, error?: string, data?: Object }
 */
function validateWebSocketMessage(message) {
    // Check if message is an object
    if (!message || typeof message !== 'object') {
        return {
            valid: false,
            error: 'Invalid message format: must be a JSON object'
        };
    }

    // Check message size (prevent DoS)
    const messageSize = JSON.stringify(message).length;
    if (messageSize > 100000) { // 100KB limit
        return {
            valid: false,
            error: 'Message too large: maximum 100KB allowed'
        };
    }

    // Get action-specific schema
    const action = message.action;
    if (!action) {
        return {
            valid: false,
            error: 'Missing required field: action'
        };
    }

    const schema = wsMessageSchemas[action];
    if (!schema) {
        return {
            valid: false,
            error: `Unknown action: ${action}`
        };
    }

    // Validate against schema
    const { error, value } = schema.validate(message, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errorMessages = error.details.map(detail => detail.message).join('; ');
        return {
            valid: false,
            error: `Validation failed: ${errorMessages}`
        };
    }

    return {
        valid: true,
        data: value
    };
}

/**
 * Validate API query parameters
 * @param {Object} query - The query object to validate
 * @param {string} schemaName - Name of the schema to use
 * @returns {Object} { valid: boolean, error?: string, data?: Object }
 */
function validateApiQuery(query, schemaName) {
    const schema = apiSchemas[schemaName];
    if (!schema) {
        logger.error('Unknown validation schema', { schemaName });
        return {
            valid: false,
            error: 'Internal validation error'
        };
    }

    const { error, value } = schema.validate(query, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errorMessages = error.details.map(detail => detail.message).join('; ');
        return {
            valid: false,
            error: errorMessages
        };
    }

    return {
        valid: true,
        data: value
    };
}

/**
 * Validate API request body
 * @param {Object} body - The body object to validate
 * @param {string} schemaName - Name of the schema to use
 * @returns {Object} { valid: boolean, error?: string, data?: Object }
 */
function validateApiBody(body, schemaName) {
    const schema = apiSchemas[schemaName];
    if (!schema) {
        logger.error('Unknown validation schema', { schemaName });
        return {
            valid: false,
            error: 'Internal validation error'
        };
    }

    const { error, value } = schema.validate(body, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errorMessages = error.details.map(detail => detail.message).join('; ');
        return {
            valid: false,
            error: errorMessages
        };
    }

    return {
        valid: true,
        data: value
    };
}

/**
 * Sanitize string input (remove potentially dangerous characters)
 * @param {string} input - The string to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(input) {
    if (typeof input !== 'string') return input;

    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '');

    // Remove script content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
}

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

/**
 * Express middleware for query validation
 * @param {string} schemaName - Schema to validate against
 */
function validateQuery(schemaName) {
    return (req, res, next) => {
        const result = validateApiQuery(req.query, schemaName);

        if (!result.valid) {
            logger.warn('Query validation failed', {
                path: req.path,
                error: result.error,
                ip: req.ip
            });
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        // Replace query with validated data
        req.query = result.data;
        next();
    };
}

/**
 * Express middleware for body validation
 * @param {string} schemaName - Schema to validate against
 */
function validateBody(schemaName) {
    return (req, res, next) => {
        const result = validateApiBody(req.body, schemaName);

        if (!result.valid) {
            logger.warn('Body validation failed', {
                path: req.path,
                error: result.error,
                ip: req.ip
            });
            return res.status(400).json({
                success: false,
                error: result.error
            });
        }

        // Replace body with validated data
        req.body = result.data;
        next();
    };
}

module.exports = {
    validateWebSocketMessage,
    validateApiQuery,
    validateApiBody,
    validateQuery,
    validateBody,
    sanitizeString,
    schemas: {
        ws: wsMessageSchemas,
        api: apiSchemas
    }
};
