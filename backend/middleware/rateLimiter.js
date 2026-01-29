// Rate Limiter Middleware
// PostgreSQL-backed sliding window rate limiter

const { query } = require('../config/database');
const config = require('../config/environment');
const logger = require('../utils/logger');

/**
 * Check if request allowed for IP
 * @param {string} ipAddress 
 * @param {string} endpoint - Identifier for the limit (e.g., 'websocket_connect')
 * @returns {Promise<boolean>}
 */
async function checkRateLimit(ipAddress, endpoint) {
    const { maxConnectionsPerIp, maxMessagesPerMinute, windowMs } = config.rateLimit;

    // Choose limit based on endpoint
    let limit = maxMessagesPerMinute;
    if (endpoint === 'connect') {
        limit = maxConnectionsPerIp;
    }

    try {
        // Simple sliding window using the table
        // 1. Clean old records defined by window
        // (Optional: can rely on background job, but strictly do it per request or periodic)
        // Here we'll just insert/update

        // We will use a simplified approach: 
        // `rate_limits` table has `request_count` and `window_start`.
        // If window_start is old, reset. Else increment.

        // Using UPSERT logic
        // But schema says: UNIQUE(ip_address, endpoint, window_start)
        // Actually schema definition in Task 0 was: UNIQUE(ip_address, endpoint, window_start) 
        // wait, schema.sql says: UNIQUE(ip_address, endpoint, window_start)
        // This implies we create new rows for new windows? That might fill up table.

        // Alternative: Just simple bucket matches.

        // Let's implement a transactional check:
        const now = new Date();
        // Round to nearest window start (e.g. minute)
        // or just check count in last X seconds.

        // Simpler query: Count requests in last windowMs
        // but the table structure in schema.sql was designed for bucket approach.

        // Let's stick to the schema we created:
        // id, ip_address, endpoint, request_count, window_start
        // UNIQUE(ip_address, endpoint, window_start)

        // We should probably just have UNIQUE(ip_address, endpoint) and update window_start?
        // Let's check schema again? 
        // "UNIQUE(ip_address, endpoint, window_start)"

        // Let's simplify: Delete old usage for this IP, insert new usage

        const windowStart = new Date(Date.now() - windowMs);

        // Remove expired entries for this specific IP/endpoint
        await query(`DELETE FROM rate_limits WHERE ip_address = $1 AND endpoint = $2 AND window_start < $3`, [ipAddress, endpoint, windowStart]);

        // Count current
        const res = await query(`SELECT SUM(request_count) as total FROM rate_limits WHERE ip_address = $1 AND endpoint = $2`, [ipAddress, endpoint]);
        const currentCount = parseInt(res.rows[0].total) || 0;

        if (currentCount >= limit) {
            logger.warn(`Rate limit exceeded`, { ipAddress, endpoint, currentCount, limit });
            return false;
        }

        // Record usage
        // We'll just insert a new record with NOW().
        // Warning: Schema constraint might conflict if we use bucket logic. 
        // The schema was: UNIQUE(ip_address, endpoint, window_start)
        // If window_start is exact timestamp, it's fine.

        await query(
            `INSERT INTO rate_limits (ip_address, endpoint, request_count, window_start) VALUES ($1, $2, 1, CURRENT_TIMESTAMP)`,
            [ipAddress, endpoint]
        );

        return true;
    } catch (err) {
        logger.error('Rate limit check failed', { error: err.message });
        // Fail open if DB error? or Fail closed?
        // Fail open to prevent service outage during DB blip
        return true;
    }
}

module.exports = {
    checkRateLimit
};
