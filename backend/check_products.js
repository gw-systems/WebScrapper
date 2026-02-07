const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'webscrapper',
    user: 'webscrapper_user',
    password: 'dev_password_123'
});

async function checkProducts() {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM products');
        const count = parseInt(result.rows[0].count);

        console.log(`\n📊 Products in database: ${count}`);

        if (count > 0) {
            const sample = await pool.query('SELECT name, offer_price, in_stock FROM products LIMIT 3');
            console.log('\nSample products:');
            sample.rows.forEach(p => {
                console.log(` - ${p.name} (₹${p.offer_price / 100}) [Stock: ${p.in_stock}]`);
            });
            console.log('\n✅ Verification Successful!');
        } else {
            console.log('❌ No products found.');
        }

    } catch (error) {
        console.error('Error checking products:', error);
    } finally {
        await pool.end();
    }
}

checkProducts();
