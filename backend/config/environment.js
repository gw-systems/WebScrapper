// Environment Configuration
// Validates and exports all environment variables with defaults

require('dotenv').config();

// Validate required environment variables
function validateEnv() {
    const required = [
        'DB_HOST',
        'DB_PORT',
        'DB_NAME',
        'DB_USER',
        'DB_PASSWORD'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}\nPlease create a .env file with these variables.`);
    }
}

// Validate on import
validateEnv();

// Export configuration object
const config = {
    // Environment
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',

    // Server
    port: parseInt(process.env.PORT) || 5000,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

    // Database
    database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        name: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        poolMin: parseInt(process.env.DB_POOL_MIN) || 2,
        poolMax: parseInt(process.env.DB_POOL_MAX) || 10,
    },

    // Browser Pool
    browserPool: {
        maxBrowsers: parseInt(process.env.MAX_BROWSERS) || 10,
        ttlMs: parseInt(process.env.BROWSER_TTL_MS) || 300000, // 5 minutes
    },

    // Rate Limiting
    rateLimit: {
        maxConnectionsPerIp: parseInt(process.env.MAX_CONNECTIONS_PER_IP) || 100,
        maxMessagesPerMinute: parseInt(process.env.MAX_MESSAGES_PER_MINUTE) || 300,
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    },

    // Authentication
    auth: {
        apiKeySecret: process.env.API_KEY_SECRET,
        jwtSecret: process.env.JWT_SECRET,
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        dir: process.env.LOG_DIR || './logs',
    },
};

module.exports = config;
