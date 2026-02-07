const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Hardcode connection for migration to avoid .env issues
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'webscrapper',
    user: 'webscrapper_user',
    password: 'dev_password_123'
});

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'database/migrations/002_add_products_table.sql');
        console.log(`Reading SQL from: ${sqlPath}`);

        if (!fs.existsSync(sqlPath)) {
            throw new Error('SQL file not found');
        }

        const sql = fs.readFileSync(sqlPath, 'utf-8');

        console.log('SQL Check:');
        console.log('--- START ---');
        console.log(sql.substring(0, 50) + '...');
        console.log('--- END ---');

        console.log('Running migration...');
        await pool.query(sql);
        console.log('✅ Migration successful!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();
