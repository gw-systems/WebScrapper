// WebSocket Authentication Middleware
const { ApiKey } = require('../models/ApiKey'); // Fix import if model structure differs
const ApiKeyModel = require('../models/ApiKey'); // Check file name case
const logger = require('../utils/logger');
const config = require('../config/environment');

async function authenticate(req) {
    // If authentication disabled (e.g. dev mode without keys setup yet?), we could skip.
    // But plan says "API key authentication using shared secret" is Option 1 
    // OR PostgreSQL validation.

    // We implemented ApiKey model, so let's use it.

    // Extract key
    const url = new URL(req.url, `http://${req.headers.host}`);
    const apiKey = url.searchParams.get('apiKey');

    if (!apiKey) {
        return { success: false, error: 'Missing API key' };
    }

    // Check valid DB key
    const isValid = await ApiKeyModel.validate(apiKey);

    if (!isValid) {
        return { success: false, error: 'Invalid API key' };
    }

    // Record usage
    ApiKeyModel.recordUsage(apiKey).catch(err => logger.error('Async usage record failed', { error: err.message }));

    return { success: true, apiKey };
}

module.exports = { authenticate };
