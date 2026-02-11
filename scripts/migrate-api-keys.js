/**
 * Migration Script: Hash Existing API Keys
 * 
 * This script migrates existing plain-text API keys to hashed versions.
 * 
 * IMPORTANT NOTES:
 * - This script will read all existing plain-text keys from the database
 * - It will hash them using SHA256 (same algorithm as ApiKey.hashKey)
 * - It will update the database records with the hashed versions
 * - This preserves existing keys so they continue to work after migration
 * 
 * USAGE:
 *   node scripts/migrate-api-keys.js
 * 
 * BACKUP RECOMMENDATION:
 *   pg_dump -U webscraper_user -t api_keys webscraper > api_keys_backup.sql
 */


const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Manually load backend .env file
const envPath = path.join(__dirname, '../backend/.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                process.env[key.trim()] = valueParts.join('=').trim();
            }
        }
    });
}

// Create database connection pool
const pool = new Pool({
    user: process.env.DB_USER || 'webscraper_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'webscraper',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});


// Same hashing function as ApiKey model
function hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

async function migrateApiKeys() {
    try {
        console.log('\\n========================================');
        console.log('API Key Migration Script');
        console.log('========================================\\n');

        // 1. Fetch all existing API keys
        console.log('📥 Fetching existing API keys from database...');
        const result = await pool.query('SELECT id, key, name FROM api_keys');

        if (result.rows.length === 0) {
            console.log('✅ No API keys found in database. Nothing to migrate.');
            await pool.end();
            process.exit(0);
        }

        console.log(`Found ${result.rows.length} API key(s) to migrate\\n`);

        // 2. Check if keys are already hashed (64 hex chars = SHA256)
        const alreadyHashed = result.rows.filter(row => /^[a-f0-9]{64}$/i.test(row.key));
        if (alreadyHashed.length === result.rows.length) {
            console.log('✅ All API keys are already hashed. No migration needed.');
            await pool.end();
            process.exit(0);
        }

        if (alreadyHashed.length > 0) {
            console.log(`⚠️  Warning: ${alreadyHashed.length} key(s) already appear to be hashed.`);
        }

        // 3. Migrate each plain-text key
        console.log('🔄 Starting migration...\\n');

        let migrated = 0;
        let skipped = 0;

        for (const row of result.rows) {
            const { id, key, name } = row;

            // Skip if already hashed
            if (/^[a-f0-9]{64}$/i.test(key)) {
                console.log(`  ⏭️  Skipping "${name}" (ID: ${id}) - already hashed`);
                skipped++;
                continue;
            }

            // Hash and update
            const hashedKey = hashKey(key);
            await pool.query(
                'UPDATE api_keys SET key = $1 WHERE id = $2',
                [hashedKey, id]
            );

            console.log(`  ✅ Migrated "${name}" (ID: ${id})`);
            console.log(`     Raw key: ${key.substring(0, 20)}...`);
            console.log(`     Hash:    ${hashedKey.substring(0, 20)}...\\n`);

            migrated++;
        }

        // 4. Summary
        console.log('========================================');
        console.log('Migration Complete!');
        console.log('========================================');
        console.log(`✅ Migrated: ${migrated} key(s)`);
        console.log(`⏭️  Skipped:  ${skipped} key(s)`);
        console.log('');
        console.log('⚠️  IMPORTANT: The raw API keys shown above are no longer');
        console.log('   stored in the database. Save them if needed!');
        console.log('');

        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('\\n❌ Migration failed:', error.message);
        console.error(error.stack);
        await pool.end();
        process.exit(1);
    }
}

// Run migration
migrateApiKeys();
