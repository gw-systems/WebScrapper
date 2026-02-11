// ApiKey Model
// Handles API key validation and management

const { query } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

class ApiKey {
    /**
     * Hash an API key using SHA256
     * @param {string} key - The raw API key
     * @returns {string} - Hashed key (hex)
     */
    static hashKey(key) {
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    /**
     * Validate an API key
     * @param {string} key - The API key to validate
     * @returns {Promise<boolean>} - True if valid and active
     */
    static async validate(key) {
        try {
            // Hash the incoming key before checking database
            const hashedKey = this.hashKey(key);

            const result = await query(
                'SELECT id, is_active FROM api_keys WHERE key = $1',
                [hashedKey]
            );

            if (result.rows.length === 0) {
                logger.warn('Invalid API key attempted', { keyHash: hashedKey.substring(0, 10) + '...' });
                return false;
            }

            const apiKey = result.rows[0];

            if (!apiKey.is_active) {
                logger.warn('Inactive API key attempted', { keyHash: hashedKey.substring(0, 10) + '...' });
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
            // Hash the key before updating
            const hashedKey = this.hashKey(key);

            await query(
                `UPDATE api_keys
         SET last_used_at = CURRENT_TIMESTAMP,
             usage_count = usage_count + 1
         WHERE key = $1`,
                [hashedKey]
            );

            logger.debug('API key usage recorded', { keyHash: hashedKey.substring(0, 10) + '...' });
        } catch (error) {
            logger.error('Error recording API key usage', { error: error.message });
        }
    }

    /**
     * Get API key by raw key string (hashes it first)
     * @param {string} key - The raw API key
     * @returns {Promise<Object|null>} - API key object or null
     */
    static async getByKey(key) {
        try {
            const hashedKey = this.hashKey(key);

            const result = await query(
                'SELECT * FROM api_keys WHERE key = $1',
                [hashedKey]
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
            // Generate secure random key (64 hex chars = 32 bytes)
            const rawKey = crypto.randomBytes(32).toString('hex');
            const hashedKey = this.hashKey(rawKey);

            const result = await query(
                `INSERT INTO api_keys (key, name, is_active)
         VALUES ($1, $2, true)
         RETURNING id, name, is_active, created_at`,
                [hashedKey, name]
            );

            logger.info('API key created', { name, id: result.rows[0].id });

            // CRITICAL: Return the raw key to the user (only time they'll see it)
            // The database stores only the hash
            return {
                ...result.rows[0],
                key: rawKey  // Return raw key, not hash
            };
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
            // Hash the key before revoking
            const hashedKey = this.hashKey(key);

            const result = await query(
                'UPDATE api_keys SET is_active = false WHERE key = $1 RETURNING id',
                [hashedKey]
            );

            if (result.rows.length > 0) {
                logger.info('API key revoked', { keyHash: hashedKey.substring(0, 10) + '...' });
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
