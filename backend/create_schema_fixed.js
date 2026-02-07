const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'webscrapper',
    user: 'webscrapper_user',
    password: 'dev_password_123'
});

async function createSchema() {
    const client = await pool.connect();

    try {
        console.log('Starting schema creation...');
        await client.query('BEGIN');

        // 1. Create Table
        console.log('Creating table `products`...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        scraping_job_id INTEGER REFERENCES scraping_jobs(id) ON DELETE SET NULL,
        sku_id VARCHAR(50) NOT NULL,
        spin_id VARCHAR(50),
        name VARCHAR(500) NOT NULL,
        brand VARCHAR(255),
        category VARCHAR(255),
        super_category VARCHAR(255),
        sub_category VARCHAR(255),
        mrp INTEGER,
        offer_price INTEGER,
        discount INTEGER,
        discount_percent DECIMAL(5,2),
        unit_price VARCHAR(100),
        quantity VARCHAR(100),
        weight VARCHAR(100),
        in_stock BOOLEAN DEFAULT false,
        max_quantity INTEGER,
        images JSONB,
        primary_image TEXT,
        description TEXT,
        pod_id VARCHAR(50),
        weight_grams INTEGER,
        is_listing_variant BOOLEAN DEFAULT false,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // 2. Create Unique Index (replaces UNIQUE constraint)
        console.log('Creating unique index...');
        // Drop logic to ensure we can rerun
        await client.query(`DROP INDEX IF EXISTS idx_products_unique_daily`);
        await client.query(`
      CREATE UNIQUE INDEX idx_products_unique_daily 
      ON products(sku_id, pod_id, (scraped_at::date))
    `);

        // 3. Create other indexes
        console.log('Creating other indexes...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_job ON products(scraping_job_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_scraped ON products(scraped_at DESC)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_in_stock ON products(in_stock) WHERE in_stock = true`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_name_search ON products USING gin(to_tsvector('english', name))`);

        // 4. Create Function
        console.log('Creating trigger function...');
        await client.query(`
      CREATE OR REPLACE FUNCTION update_products_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

        // 5. Create Trigger
        console.log('Creating trigger...');
        await client.query(`DROP TRIGGER IF EXISTS trigger_update_products_timestamp ON products`);
        await client.query(`
      CREATE TRIGGER trigger_update_products_timestamp
      BEFORE UPDATE ON products
      FOR EACH ROW
      EXECUTE FUNCTION update_products_updated_at()
    `);

        await client.query('COMMIT');
        console.log('✅ Schema created successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Failed to create schema:');
        console.error(error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

createSchema();
