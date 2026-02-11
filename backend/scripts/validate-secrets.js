#!/usr/bin/env node

/**
 * Secrets Validation Script
 * Validates environment variables before deployment
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    bold: '\x1b[1m'
};

// Load .env file if it exists
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log(`${colors.green}✓${colors.reset} Loaded environment from .env file\n`);
} else {
    console.error(`${colors.red}✗${colors.reset} No .env file found at ${envPath}`);
    console.log(`${colors.yellow}⚠${colors.reset} Copy .env.example to .env and configure it\n`);
    process.exit(1);
}

// Configuration
const REQUIRED_VARS = [
    'NODE_ENV',
    'PORT',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'API_KEY_SECRET',
    'JWT_SECRET',
    'MAX_BROWSERS_TOTAL',
    'MAX_BROWSERS_PER_USER',
    'BROWSER_TTL_MS',
    'SCRAPING_TIMEOUT_MS',
    'SEARCH_TIMEOUT_MS'
];

const WEAK_DEFAULTS = [
    'GENERATE_THIS_SECRET_DO_NOT_USE_THIS_VALUE',
    'your_database_password_here',
    'changeme',
    'password',
    'secret',
    '123456'
];

const MIN_SECRET_LENGTH = 32;
const MIN_DB_PASSWORD_LENGTH = 12;

// Validation results
const results = {
    missing: [],
    weak: [],
    warnings: [],
    passed: []
};

console.log(`${colors.bold}${colors.blue}WebScraper Secrets Validation${colors.reset}\n`);
console.log('='.repeat(60));
console.log('');

// Check required variables
console.log(`${colors.bold}Checking Required Variables...${colors.reset}`);
REQUIRED_VARS.forEach(varName => {
    const value = process.env[varName];

    if (!value || value.trim() === '') {
        results.missing.push(varName);
        console.log(`${colors.red}✗${colors.reset} ${varName}: Missing`);
    } else {
        console.log(`${colors.green}✓${colors.reset} ${varName}: Present`);
        results.passed.push(varName);
    }
});

console.log('');

// Check secret strength
console.log(`${colors.bold}Checking Secret Strength...${colors.reset}`);

function checkSecret(varName, minLength = MIN_SECRET_LENGTH) {
    const value = process.env[varName];

    if (!value) return; // Already reported as missing

    // Check for weak defaults
    if (WEAK_DEFAULTS.some(weak => value.includes(weak))) {
        results.weak.push({
            name: varName,
            reason: 'Using default/weak value'
        });
        console.log(`${colors.red}✗${colors.reset} ${varName}: Using default/weak value`);
        return;
    }

    // Check length
    if (value.length < minLength) {
        results.weak.push({
            name: varName,
            reason: `Too short (${value.length} chars, minimum ${minLength})`
        });
        console.log(`${colors.yellow}⚠${colors.reset} ${varName}: Too short (${value.length} chars, minimum ${minLength})`);
        return;
    }

    console.log(`${colors.green}✓${colors.reset} ${varName}: Strong (${value.length} characters)`);
}

checkSecret('API_KEY_SECRET');
checkSecret('JWT_SECRET');
checkSecret('DB_PASSWORD', MIN_DB_PASSWORD_LENGTH);

console.log('');

// Production-specific checks
if (process.env.NODE_ENV === 'production') {
    console.log(`${colors.bold}Production Environment Checks...${colors.reset}`);

    // Check HTTPS
    if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.startsWith('https://')) {
        results.warnings.push({
            name: 'FRONTEND_URL',
            message: 'Should use HTTPS in production'
        });
        console.log(`${colors.yellow}⚠${colors.reset} FRONTEND_URL: Should use HTTPS in production`);
    }

    // Check log level
    if (process.env.LOG_LEVEL === 'debug') {
        results.warnings.push({
            name: 'LOG_LEVEL',
            message: 'Debug logging may impact performance'
        });
        console.log(`${colors.yellow}⚠${colors.reset} LOG_LEVEL: Debug logging may impact performance`);
    }

    // Check browser limits
    const maxBrowsers = parseInt(process.env.MAX_BROWSERS_TOTAL);
    if (maxBrowsers > 50) {
        results.warnings.push({
            name: 'MAX_BROWSERS_TOTAL',
            message: 'Very high browser limit may cause resource issues'
        });
        console.log(`${colors.yellow}⚠${colors.reset} MAX_BROWSERS_TOTAL: Very high (${maxBrowsers}), may cause resource issues`);
    }

    if (results.warnings.length === 0) {
        console.log(`${colors.green}✓${colors.reset} All production checks passed`);
    }

    console.log('');
}

// Configuration display
console.log(`${colors.bold}Current Configuration:${colors.reset}`);
console.log(`  Environment: ${process.env.NODE_ENV}`);
console.log(`  Port: ${process.env.PORT}`);
console.log(`  Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
console.log(`  Max Browsers: ${process.env.MAX_BROWSERS_TOTAL} total, ${process.env.MAX_BROWSERS_PER_USER} per user`);
console.log(`  Scraping Timeout: ${parseInt(process.env.SCRAPING_TIMEOUT_MS) / 1000}s`);
console.log(`  Search Timeout: ${parseInt(process.env.SEARCH_TIMEOUT_MS) / 1000}s`);
console.log('');

// Summary
console.log('='.repeat(60));
console.log(`${colors.bold}Validation Summary${colors.reset}\n`);

if (results.passed.length > 0) {
    console.log(`${colors.green}✓ Passed:${colors.reset} ${results.passed.length} variables`);
}

if (results.missing.length > 0) {
    console.log(`${colors.red}✗ Missing:${colors.reset} ${results.missing.length} required variables`);
    results.missing.forEach(v => console.log(`    - ${v}`));
}

if (results.weak.length > 0) {
    console.log(`${colors.red}✗ Weak Secrets:${colors.reset} ${results.weak.length} variables`);
    results.weak.forEach(v => console.log(`    - ${v.name}: ${v.reason}`));
}

if (results.warnings.length > 0) {
    console.log(`${colors.yellow}⚠ Warnings:${colors.reset} ${results.warnings.length} issues`);
    results.warnings.forEach(w => console.log(`    - ${w.name}: ${w.message}`));
}

console.log('');

// Exit code
const hasErrors = results.missing.length > 0 || results.weak.length > 0;

if (hasErrors) {
    console.log(`${colors.red}${colors.bold}✗ Validation FAILED${colors.reset}`);
    console.log(`${colors.yellow}Fix the issues above before deploying to production${colors.reset}`);
    console.log(`${colors.blue}Run 'node scripts/generate-secrets.js' to generate secure secrets${colors.reset}\n`);
    process.exit(1);
} else if (results.warnings.length > 0) {
    console.log(`${colors.yellow}${colors.bold}⚠ Validation PASSED with warnings${colors.reset}`);
    console.log(`${colors.yellow}Review warnings above${colors.reset}\n`);
    process.exit(0);
} else {
    console.log(`${colors.green}${colors.bold}✓ Validation PASSED${colors.reset}`);
    console.log(`${colors.green}Configuration is secure and ready for deployment${colors.reset}\n`);
    process.exit(0);
}
