#!/usr/bin/env node
/**
 * Secrets Generation Utility
 * Generates cryptographically secure secrets for .env configuration
 * 
 * Usage: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

/**
 * Generate a cryptographically secure random string
 * @param {number} bytes - Number of bytes to generate
 * @returns {string} Hex-encoded random string
 */
function generateSecret(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
function generateUUID() {
    return crypto.randomUUID();
}

console.log('='.repeat(70));
console.log('Security Secrets Generator');
console.log('='.repeat(70));
console.log('');

console.log('Generated secrets for your .env file:\n');

const apiKeySecret = generateSecret(32);
const jwtSecret = generateSecret(32);
const devApiKey = generateUUID();
const prodApiKey = generateUUID();

console.log('# Authentication Secrets');
console.log(`API_KEY_SECRET=${apiKeySecret}`);
console.log(`JWT_SECRET=${jwtSecret}`);
console.log('');

console.log('# API Keys for Database Seeding');
console.log('# Add these to database/seeds/dev_api_keys.sql');
console.log(`DEV_API_KEY=${devApiKey}`);
console.log(`PROD_API_KEY=${prodApiKey}`);
console.log('');

console.log('='.repeat(70));
console.log('IMPORTANT SECURITY INSTRUCTIONS:');
console.log('='.repeat(70));
console.log('1. Copy the API_KEY_SECRET and JWT_SECRET to your backend/.env file');
console.log('2. Update database/seeds/dev_api_keys.sql with the generated API keys');
console.log('3. Run the database seed script to add API keys to the database');
console.log('4. NEVER commit these secrets to version control');
console.log('5. Generate NEW secrets for production deployments');
console.log('='.repeat(70));
console.log('');

// Also output as JSON for programmatic use
const secrets = {
    API_KEY_SECRET: apiKeySecret,
    JWT_SECRET: jwtSecret,
    DEV_API_KEY: devApiKey,
    PROD_API_KEY: prodApiKey,
    generated_at: new Date().toISOString()
};

console.log('JSON format (for scripts):');
console.log(JSON.stringify(secrets, null, 2));
