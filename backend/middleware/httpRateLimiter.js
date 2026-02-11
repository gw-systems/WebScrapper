/**
 * HTTP Rate Limiting Middleware
 * Uses express-rate-limit for API endpoint protection
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const config = require('../config/environment');

/**
 * Global rate limiter for all API endpoints
 * 100 requests per 15 minutes per IP
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers

    // Note: express-rate-limit automatically handles X-Forwarded-For and IPv6
    // Set app.set('trust proxy', 1) in server.js if behind a proxy

    // Log rate limit violations
    handler: (req, res) => {
        const ip = req.ip; // req.ip already handles X-Forwarded-For when trust proxy is set
        logger.warn('Rate limit exceeded', {
            ip,
            path: req.path,
            method: req.method
        });

        res.status(429).json({
            success: false,
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

/**
 * Strict rate limiter for resource-intensive operations
 * 5 requests per hour
 */
const strictLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 requests per hour
    message: {
        success: false,
        error: 'This operation is rate limited. Maximum 5 requests per hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,


    handler: (req, res) => {
        const ip = req.ip;
        logger.warn('Strict rate limit exceeded', {
            ip,
            path: req.path,
            method: req.method
        });

        res.status(429).json({
            success: false,
            error: 'This operation is rate limited. Maximum 5 requests per hour.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    },

    // Skip rate limiting in development if needed
    skip: (req) => {
        return config.isDevelopment && req.query.skipRateLimit === 'dev';
    }
});

/**
 * Moderate rate limiter for read operations
 * 200 requests per 15 minutes
 */
const moderateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,


});

module.exports = {
    globalLimiter,
    strictLimiter,
    moderateLimiter
};
