// Structured Logger (Winston)
// Handles file rotation, console output, and consistent formatting

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('../config/environment');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        if (metaStr === '{}') metaStr = '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    defaultMeta: { service: 'webscraper-backend' },
    transports: [
        // Error logs - 14 days retention
        new DailyRotateFile({
            filename: path.join(config.logging.dir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error',
        }),

        // Combined logs - 14 days retention
        new DailyRotateFile({
            filename: path.join(config.logging.dir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
        }),
    ],
});

// Add console transport for non-production environments
if (config.nodeEnv !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
    }));
}

// Create logs directory if it doesn't exist (handled by Winston usually, but good practice)
// Note: Winston creates the directory automatically.

module.exports = logger;
