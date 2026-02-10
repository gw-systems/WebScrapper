const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'webscraper',
    user: 'webscraper_user',
    password: 'dev_password_123'
});

async function listTables() {
    try {
        console.log('Connecting...');
        const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

        console.log('Tables found:');
        result.rows.forEach(row => {
            console.log(` - ${row.table_name}`);
        });

    } catch (error) {
        console.error('Error listing tables:', error);
    } finally {
        await pool.end();
    }
}

listTables();
