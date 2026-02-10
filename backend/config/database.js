// Database Configuration
// PostgreSQL connection setup with pooling

const { Pool } = require('pg');
const logger = require('../utils/logger');

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    throw new Error(`Missing required database environment variables: ${missingVars.join(', ')}`);
}

// Database connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'webscraper',
    user: process.env.DB_USER || 'webscraper_user',
    password: process.env.DB_PASSWORD,

    // Connection pool settings
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    max: parseInt(process.env.DB_POOL_MAX) || 10,

    // Connection timeout
    connectionTimeoutMillis: 5000,

    // Idle timeout
    idleTimeoutMillis: 30000,

    // Statement timeout (30 seconds)
    statement_timeout: 30000,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err, client) => {
    logger.error('Unexpected database pool error', { error: err.message, stack: err.stack });
});

// Handle successful connections
pool.on('connect', () => {
    logger.debug('New database client connected to pool');
});

// Handle client removal
pool.on('remove', () => {
    logger.debug('Database client removed from pool');
});

// Test connection function
async function testConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as now, version() as version');
        client.release();

        logger.info('Database connection successful', {
            timestamp: result.rows[0].now,
            version: result.rows[0].version
        });

        return true;
    } catch (error) {
        logger.error('Database connection failed', { error: error.message });
        throw error;
    }
}

// Graceful shutdown
async function closePool() {
    try {
        await pool.end();
        logger.info('Database pool closed gracefully');
    } catch (error) {
        logger.error('Error closing database pool', { error: error.message });
        throw error;
    }
}

// Query helper with error handling
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;

        logger.debug('Query executed', {
            query: text.substring(0, 100), // Log first 100 chars
            duration: `${duration}ms`,
            rows: result.rowCount
        });

        return result;
    } catch (error) {
        logger.error('Query error', {
            query: text.substring(0, 100),
            error: error.message,
            params: params
        });
        throw error;
    }
}

// Transaction helper
async function transaction(callback) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Transaction rolled back', { error: error.message });
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    query,
    transaction,
    testConnection,
    closePool
};
