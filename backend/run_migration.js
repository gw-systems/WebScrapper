const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Hardcode connection for migration
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'webscraper',
    user: 'webscraper_user',
    password: 'dev_password_123'
});

function cleanSql(sql) {
    // Remove BOM
    if (sql.charCodeAt(0) === 0xFEFF) {
        sql = sql.slice(1);
    }

    return sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--')) // Remove single line comments
        .join('\n')
        .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
}

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../database/migrations/002_add_products_table.sql');
        console.log(`Reading SQL from: ${sqlPath}`);

        if (!fs.existsSync(sqlPath)) {
            throw new Error('SQL file not found');
        }

        let sql = fs.readFileSync(sqlPath, 'utf-8');
        sql = cleanSql(sql);

        // Split by semicolon, but handle $$ blocks carefully
        // Since we know the structure, we can just split by top-level semicolons
        // The function body uses $$...$$, so splitting by ; inside might break it.
        // However, for this specific file, the function body relies on PL/PGSQL.

        // For simplicity, let's just try to executing the whole thing again but cleaned
        // If that fails, we are in trouble with multi-statement support.

        console.log('Running migration (cleaned)...');
        await pool.query(sql);
        console.log('✅ Migration successful!');

    } catch (error) {
        console.error('❌ Migration failed:', error);

        // Fallback: Try splitting statements roughly
        if (error.code === '42601') {
            console.log('Retrying by splitting statements...');
            // This is a naive split
            const statements = sql.split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            for (const stmt of statements) {
                try {
                    await pool.query(stmt);
                    console.log('Executed statement.');
                } catch (e) {
                    console.error('Statement failed:', e.message);
                    console.error('Statement start:', stmt.substring(0, 50));
                }
            }
            console.log('Split execution done.');
        }
    } finally {
        await pool.end();
    }
}

runMigration();
