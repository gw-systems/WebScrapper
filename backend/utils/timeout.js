// Timeout Utility
// Provides timeout wrapper for async operations with proper cleanup

const logger = require('./logger');

/**
 * Wraps a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of operation for error messages
 * @returns {Promise} The wrapped promise that rejects on timeout
 */
async function withTimeout(promise, timeoutMs, operationName = 'Operation') {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            const error = new Error(`${operationName} timed out after ${timeoutMs}ms`);
            error.code = 'TIMEOUT';
            error.timeout = timeoutMs;
            reject(error);
        }, timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Creates an AbortController that times out
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {AbortController}
 */
function createTimeoutController(timeoutMs) {
    const controller = new AbortController();

    setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    return controller;
}

/**
 * Checks if an error is a timeout error
 * @param {Error} error 
 * @returns {boolean}
 */
function isTimeoutError(error) {
    return error.code === 'TIMEOUT' || error.name === 'AbortError';
}

module.exports = {
    withTimeout,
    createTimeoutController,
    isTimeoutError
};
