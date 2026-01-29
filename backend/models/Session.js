// Session Model
// Manages WebSocket session tracking

const { query } = require('../config/database');
const logger = require('../utils/logger');

class Session {
    /**
     * Create a new session
     * @param {string} clientId - Client ID from WebSocket
     * @param {string} apiKey - API key used
     * @param {string} ipAddress - Client IP address
     * @param {string} userAgent - Client user agent
     * @returns {Promise<Object>} - Created session object
     */
    static async create(clientId, apiKey, ipAddress = null, userAgent = null) {
        try {
            // Get API key ID
            const apiKeyResult = await query(
                'SELECT id FROM api_keys WHERE key = $1',
                [apiKey]
            );

            const apiKeyId = apiKeyResult.rows.length > 0 ? apiKeyResult.rows[0].id : null;

            const result = await query(
                `INSERT INTO sessions (id, api_key_id, ip_address, user_agent, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
                [clientId, apiKeyId, ipAddress, userAgent]
            );

            logger.info('Session created', { clientId, apiKeyId, ipAddress });

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating session', { error: error.message, clientId });
            throw error;
        }
    }

    /**
     * Find active session by client ID
     * @param {string} clientId - Client ID
     * @returns {Promise<Object|null>} - Session object or null
     */
    static async findActive(clientId) {
        try {
            const result = await query(
                'SELECT * FROM sessions WHERE id = $1 AND is_active = true',
                [clientId]
            );

            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            logger.error('Error finding active session', { error: error.message, clientId });
            return null;
        }
    }

    /**
     * Terminate a session
     * @param {string} clientId - Client ID
     * @returns {Promise<boolean>} - True if terminated successfully
     */
    static async terminate(clientId) {
        try {
            const result = await query(
                `UPDATE sessions
         SET is_active = false,
             disconnected_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND is_active = true
         RETURNING id`,
                [clientId]
            );

            if (result.rows.length > 0) {
                logger.info('Session terminated', { clientId });
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error terminating session', { error: error.message, clientId });
            return false;
        }
    }

    /**
     * Clean up old/stale sessions
     * @param {number} maxAgeMinutes - Maximum age in minutes (default: 60)
     * @returns {Promise<number>} - Number of sessions cleaned up
     */
    static async cleanup(maxAgeMinutes = 60) {
        try {
            const result = await query(
                `UPDATE sessions
         SET is_active = false,
             disconnected_at = CURRENT_TIMESTAMP
         WHERE is_active = true
           AND connected_at < NOW() - INTERVAL '${maxAgeMinutes} minutes'
           AND disconnected_at IS NULL
         RETURNING id`
            );

            const count = result.rows.length;

            if (count > 0) {
                logger.info('Cleaned up stale sessions', { count, maxAgeMinutes });
            }

            return count;
        } catch (error) {
            logger.error('Error cleaning up sessions', { error: error.message });
            return 0;
        }
    }

    /**
     * Get active session count
     * @returns {Promise<number>} - Number of active sessions
     */
    static async getActiveCount() {
        try {
            const result = await query(
                'SELECT COUNT(*) as count FROM sessions WHERE is_active = true'
            );

            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error getting active session count', { error: error.message });
            return 0;
        }
    }

    /**
     * List active sessions
     * @returns {Promise<Array>} - Array of active session objects
     */
    static async listActive() {
        try {
            const result = await query(
                `SELECT s.*, a.name as api_key_name
         FROM sessions s
         LEFT JOIN api_keys a ON s.api_key_id = a.id
         WHERE s.is_active = true
         ORDER BY s.connected_at DESC`
            );

            return result.rows;
        } catch (error) {
            logger.error('Error listing active sessions', { error: error.message });
            return [];
        }
    }
}

module.exports = Session;
