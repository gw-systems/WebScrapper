// Global Error Handler Implementation
const logger = require('../utils/logger');

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

const handleError = (err) => {
    logger.error(err);
};

module.exports = {
    AppError,
    handleError
};
