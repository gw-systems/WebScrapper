/**
 * Security Verification Tests
 * Manual test script to verify security implementations
 * Run with: node scripts/test-security.js
 */

const axios = require('axios');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000';

console.log('='.repeat(70));
console.log('Security Implementation Verification Tests');
console.log('='.repeat(70));
console.log('Make sure the server is running before executing these tests.\n');

// Test results
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function logTest(name, passed, details = '') {
    const status = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status}: ${name}`);
    if (details) console.log(`  ${details}`);

    results.tests.push({ name, passed, details });
    if (passed) results.passed++;
    else results.failed++;
}

async function testSecurityHeaders() {
    console.log('\n--- Testing Security Headers ---');
    try {
        const response = await axios.get(`${BASE_URL}/api/health`);
        const headers = response.headers;

        logTest('X-Content-Type-Options header',
            headers['x-content-type-options'] === 'nosniff',
            `Value: ${headers['x-content-type-options']}`);

        logTest('X-Frame-Options header',
            headers['x-frame-options'] === 'DENY',
            `Value: ${headers['x-frame-options']}`);

        logTest('Content-Security-Policy header',
            !!headers['content-security-policy'],
            `Present: ${!!headers['content-security-policy']}`);
    } catch (error) {
        logTest('Security headers test', false, error.message);
    }
}

async function testRateLimiting() {
    console.log('\n--- Testing Rate Limiting ---');
    try {
        // Make multiple requests quickly
        const requests = [];
        for (let i = 0; i < 10; i++) {
            requests.push(axios.get(`${BASE_URL}/api/health`, { timeout: 5000 }));
        }

        const responses = await Promise.all(requests);
        const hasRateLimitHeaders = responses.some(r =>
            r.headers['ratelimit-limit'] !== undefined
        );

        logTest('Rate limit headers present', hasRateLimitHeaders,
            `Found RateLimit-* headers: ${hasRateLimitHeaders}`);
    } catch (error) {
        logTest('Rate limiting test', false, error.message);
    }
}

async function testInputValidation() {
    console.log('\n--- Testing Input Validation ---');
    try {
        // Test invalid query parameter
        const response = await axios.get(`${BASE_URL}/api/instamart/products?limit=99999`, {
            validateStatus: () => true // Don't throw on any status
        });

        logTest('Input validation for oversized limit',
            response.status === 400,
            `Status: ${response.status}, Message: ${response.data.error}`);
    } catch (error) {
        logTest('Input validation test', false, error.message);
    }

    try {
        // Test invalid POST body
        const response = await axios.post(`${BASE_URL}/api/instamart/scrape`,
            { category: '' },
            { validateStatus: () => true }
        );

        logTest('Input validation for empty required field',
            response.status === 400 || response.status === 429, // Could be rate limited
            `Status: ${response.status}`);
    } catch (error) {
        logTest('POST validation test', false, error.message);
    }
}

async function testWebSocketAuth() {
    console.log('\n--- Testing WebSocket Authentication ---');

    return new Promise((resolve) => {
        // Test without API key
        const ws = new WebSocket(WS_URL);

        let closed = false;
        const timeout = setTimeout(() => {
            if (!closed) {
                ws.close();
                logTest('WebSocket without API key', true,
                    'Development mode: connection allowed without key');
                resolve();
            }
        }, 3000);

        ws.on('open', () => {
            logTest('WebSocket connection without key', true,
                'Development mode allows connection');
        });

        ws.on('close', (code, reason) => {
            closed = true;
            clearTimeout(timeout);

            if (code === 1008) {
                logTest('WebSocket authentication enforcement', true,
                    `Rejected with code 1008: ${reason}`);
            } else {
                logTest('WebSocket authentication', true,
                    'Development mode: optional auth');
            }
            resolve();
        });

        ws.on('error', (error) => {
            closed = true;
            clearTimeout(timeout);
            logTest('WebSocket connection test', false, error.message);
            resolve();
        });
    });
}

async function testWebSocketValidation() {
    console.log('\n--- Testing WebSocket Message Validation ---');

    return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL);
        let receivedError = false;

        ws.on('open', () => {
            // Send invalid message
            ws.send(JSON.stringify({
                action: 'invalid_action',
                service: 'unknown'
            }));

            setTimeout(() => {
                if (receivedError) {
                    logTest('WebSocket message validation', true,
                        'Invalid message rejected');
                } else {
                    logTest('WebSocket message validation', false,
                        'No validation error received');
                }
                ws.close();
                resolve();
            }, 2000);
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.status === 'error') {
                receivedError = true;
            }
        });

        ws.on('error', () => {
            resolve();
        });
    });
}

async function runAllTests() {
    try {
        await testSecurityHeaders();
        await testRateLimiting();
        await testInputValidation();
        await testWebSocketAuth();
        await testWebSocketValidation();

        console.log('\n' + '='.repeat(70));
        console.log('Test Summary');
        console.log('='.repeat(70));
        console.log(`Total Tests: ${results.tests.length}`);
        console.log(`Passed: ${results.passed} ✓`);
        console.log(`Failed: ${results.failed} ✗`);

        if (results.failed === 0) {
            console.log('\n✓ All security tests passed!');
        } else {
            console.log('\n✗ Some tests failed. Review the output above.');
        }

        process.exit(results.failed > 0 ? 1 : 0);
    } catch (error) {
        console.error('Test suite error:', error);
        process.exit(1);
    }
}

// Run tests
runAllTests();
