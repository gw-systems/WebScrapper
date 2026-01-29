// Test Database Connection
// Run this to verify PostgreSQL setup

require('dotenv').config();
const { testConnection, closePool } = require('./config/database');
const ApiKey = require('./models/ApiKey');
const Session = require('./models/Session');
const ScrapingJob = require('./models/ScrapingJob');

async function test() {
    try {
        console.log('Testing database connection...\n');

        // Test connection
        await testConnection();
        console.log('✓ Database connection successful\n');

        // Test ApiKey model
        console.log('Testing ApiKey model...');
        const apiKeys = await ApiKey.listAll();
        console.log(`✓ Found ${apiKeys.length} API keys`);
        apiKeys.forEach(key => {
            console.log(`  - ${key.name}: ${key.key.substring(0, 20)}...`);
        });
        console.log();

        // Test validation
        if (apiKeys.length > 0) {
            const isValid = await ApiKey.validate(apiKeys[0].key);
            console.log(`✓ API key validation: ${isValid ? 'PASS' : 'FAIL'}\n`);
        }

        // Test Session model
        console.log('Testing Session model...');
        const activeCount = await Session.getActiveCount();
        console.log(`✓ Active sessions: ${activeCount}\n`);

        // Test ScrapingJob model
        console.log('Testing ScrapingJob model...');
        const stats = await ScrapingJob.getStats('zepto');
        console.log(`✓ Zepto stats:`, stats);
        console.log();

        console.log('========================================');
        console.log('All database tests passed! ✓');
        console.log('========================================');
        console.log('\nYou can now use the database in your application.');
        console.log('\nAPI Keys available:');
        apiKeys.forEach(key => {
            console.log(`  ${key.name}: ${key.key}`);
        });

    } catch (error) {
        console.error('\n========================================');
        console.error('Database test FAILED ✗');
        console.error('========================================');
        console.error('\nError:', error.message);
        console.error('\nPlease check:');
        console.error('1. PostgreSQL is running');
        console.error('2. .env file has correct database credentials');
        console.error('3. Database migrations have been run');
        process.exit(1);
    } finally {
        await closePool();
    }
}

test();
