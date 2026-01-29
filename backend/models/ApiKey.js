// ApiKey Model
// Handles API key validation and management

const { query } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

class ApiKey {
    /**
     * Validate an API key
     * @param {string} key - The API key to validate
     * @returns {Promise<boolean>} - True if valid and active
     */
    static async validate(key) {
        try {
            const result = await query(
                'SELECT id, is_active FROM api_keys WHERE key = $1',
                [key]
            );

            if (result.rows.length === 0) {
                logger.warn('Invalid API key attempted', { key: key.substring(0, 10) + '...' });
                return false;
            }

            const apiKey = result.rows[0];

            if (!apiKey.is_active) {
                logger.warn('Inactive API key attempted', { key: key.substring(0, 10) + '...' });
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error validating API key', { error: error.message });
            return false;
        }
    }

    /**
     * Record API key usage
     * @param {string} key - The API key
     */
    static async recordUsage(key) {
        try {
            await query(
                `UPDATE api_keys
         SET last_used_at = CURRENT_TIMESTAMP,
             usage_count = usage_count + 1
         WHERE key = $1`,
                [key]
            );

            logger.debug('API key usage recorded', { key: key.substring(0, 10) + '...' });
        } catch (error) {
            logger.error('Error recording API key usage', { error: error.message });
        }
    }

    /**
     * Get API key by key string
     * @param {string} key - The API key
     * @returns {Promise<Object|null>} - API key object or null
     */
    static async getByKey(key) {
        try {
            const result = await query(
                'SELECT * FROM api_keys WHERE key = $1',
                [key]
            );

            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            logger.error('Error getting API key', { error: error.message });
            return null;
        }
    }

    /**
     * Create a new API key
     * @param {string} name - Name/description for the key
     * @returns {Promise<Object>} - Created API key object with key
     */
    static async create(name) {
        try {
            // Generate secure random key
            const key = crypto.randomBytes(32).toString('hex');

            const result = await query(
                `INSERT INTO api_keys (key, name, is_active)
         VALUES ($1, $2, true)
         RETURNING *`,
                [key, name]
            );

            logger.info('API key created', { name, id: result.rows[0].id });

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating API key', { error: error.message, name });
            throw error;
        }
    }

    /**
     * Revoke (deactivate) an API key
     * @param {string} key - The API key to revoke
     * @returns {Promise<boolean>} - True if revoked successfully
     */
    static async revoke(key) {
        try {
            const result = await query(
                'UPDATE api_keys SET is_active = false WHERE key = $1 RETURNING id',
                [key]
            );

            if (result.rows.length > 0) {
                logger.info('API key revoked', { key: key.substring(0, 10) + '...' });
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error revoking API key', { error: error.message });
            return false;
        }
    }

    /**
     * List all API keys
     * @returns {Promise<Array>} - Array of API key objects
     */
    static async listAll() {
        try {
            const result = await query(
                'SELECT id, name, is_active, created_at, last_used_at, usage_count FROM api_keys ORDER BY created_at DESC'
            );

            return result.rows;
        } catch (error) {
            logger.error('Error listing API keys', { error: error.message });
            return [];
        }
    }
}

module.exports = ApiKey;
