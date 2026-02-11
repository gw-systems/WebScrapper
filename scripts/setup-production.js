#!/usr/bin/env node
/**
 * Production Environment Setup Script
 * Helps configure production environment variables
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

function generateSecret(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
}

function generatePassword(length = 24) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    const values = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        password += charset[values[i] % charset.length];
    }
    return password;
}

async function main() {
    console.log('═'.repeat(70));
    console.log('🚀 Production Environment Setup');
    console.log('═'.repeat(70));
    console.log('');
    console.log('This script will help you create a production .env file');
    console.log('with secure, randomly generated secrets.');
    console.log('');

    // Ask for deployment domain
    const domain = await question('Enter your deployment domain (e.g., example.com): ');

    console.log('');
    console.log('Generating secure secrets...');

    const apiKeySecret = generateSecret(32);
    const jwtSecret = generateSecret(32);
    const dbPassword = generatePassword(24);
    const grafanaPassword = generatePassword(16);
    const pgadminPassword = generatePassword(16);

    const envContent = `# PRODUCTION Environment Variables
# Generated: ${new Date().toISOString()}
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================
POSTGRES_USER=webscraper_user
POSTGRES_PASSWORD=${dbPassword}
POSTGRES_DB=webscraper

DB_USER=webscraper_user
DB_PASSWORD=${dbPassword}
DB_NAME=webscraper
DB_HOST=postgres
DB_PORT=5432
DB_POOL_MIN=2
DB_POOL_MAX=10

# ============================================================================
# APPLICATION SECRETS
# ============================================================================
API_KEY_SECRET=${apiKeySecret}
JWT_SECRET=${jwtSecret}

# ============================================================================
# ENVIRONMENT
# ============================================================================
NODE_ENV=production
PORT=5000

# ============================================================================
# FRONTEND CONFIGURATION
# ============================================================================
FRONTEND_URL=https://${domain}
BACKEND_URL=https://${domain}

# ============================================================================
# BROWSER POOL CONFIGURATION
# ============================================================================
MAX_BROWSERS_TOTAL=10
MAX_BROWSERS_PER_USER=2
SCRAPING_TIMEOUT_MS=300000
SEARCH_TIMEOUT_MS=120000

# ============================================================================
# MONITORING CREDENTIALS
# ============================================================================
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=${grafanaPassword}

PGADMIN_EMAIL=admin@${domain}
PGADMIN_PASSWORD=${pgadminPassword}
`;

    // Write to .env.production
    const envPath = path.join(__dirname, '..', '.env.production');
    fs.writeFileSync(envPath, envContent);

    // Write frontend .env.production
    const frontendEnvContent = `# Frontend Production Environment Variables
# Generated: ${new Date().toISOString()}

VITE_WS_URL=wss://${domain}
VITE_API_URL=https://${domain}
`;

    const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env.production');
    fs.writeFileSync(frontendEnvPath, frontendEnvContent);

    console.log('');
    console.log('✅ Environment files created successfully!');
    console.log('');
    console.log('📄 Files created:');
    console.log(`   - ${envPath}`);
    console.log(`   - ${frontendEnvPath}`);
    console.log('');
    console.log('🔑 Generated credentials:');
    console.log('');
    console.log('Database:');
    console.log(`   Username: webscraper_user`);
    console.log(`   Password: ${dbPassword}`);
    console.log('');
    console.log('Grafana:');
    console.log(`   URL: http://localhost:3001`);
    console.log(`   Username: admin`);
    console.log(`   Password: ${grafanaPassword}`);
    console.log('');
    console.log('pgAdmin:');
    console.log(`   URL: http://localhost:5050`);
    console.log(`   Email: admin@${domain}`);
    console.log(`   Password: ${pgadminPassword}`);
    console.log('');
    console.log('═'.repeat(70));
    console.log('⚠️  IMPORTANT: Save these credentials securely!');
    console.log('═'.repeat(70));
    console.log('');
    console.log('Next steps:');
    console.log('1. Review the generated .env.production file');
    console.log('2. Copy .env.production to .env for local testing');
    console.log('3. Build and test: docker-compose up --build');
    console.log('4. Deploy to your hosting platform');
    console.log('');

    rl.close();
}

main().catch(console.error);
