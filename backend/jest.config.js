module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'services/**/*.js',
        'middleware/**/*.js',
        'websocket/**/*.js',
        'utils/**/*.js',
        'zepto/**/*.js',
        'blinkit/**/*.js',
        '!**/node_modules/**',
        '!**/tests/**',
        '!**/*.test.js'
    ],
    coverageThreshold: {
        global: {
            statements: 60,
            branches: 60,
            functions: 60,
            lines: 60
        }
    },
    testMatch: [
        '**/tests/**/*.test.js'
    ],
    testTimeout: 30000, // 30 seconds for integration tests
    verbose: true,
    forceExit: true, // Exit after all tests complete
    detectOpenHandles: true // Detect async operations that prevent Jest from exiting
};
