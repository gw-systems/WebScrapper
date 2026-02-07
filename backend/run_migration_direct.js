const { Pool } = require('pg');

// Hardcode connection
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'webscrapper',
    user: 'webscrapper_user',
    password: 'dev_password_123'
});

const statements = [
    // 1. Create Table
    `CREATE TABLE IF NOT EXISTS products (
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sku_id, pod_id, DATE(scraped_at))
  )`,

    // 2. Indexes
    `CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku_id)`,
    `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`,
    `CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand)`,
    `CREATE INDEX IF NOT EXISTS idx_products_job ON products(scraping_job_id)`,
    `CREATE INDEX IF NOT EXISTS idx_products_scraped ON products(scraped_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_products_in_stock ON products(in_stock) WHERE in_stock = true`,
    `CREATE INDEX IF NOT EXISTS idx_products_name_search ON products USING gin(to_tsvector('english', name))`,

    // 3. Cleanup Function (Drop first to ensure clean state if replacing)
    `DROP FUNCTION IF EXISTS update_products_updated_at CASCADE`,

    // 4. Create function
    `CREATE OR REPLACE FUNCTION update_products_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql`,

    // 5. Trigger
    `DROP TRIGGER IF EXISTS trigger_update_products_timestamp ON products`,
    `CREATE TRIGGER trigger_update_products_timestamp
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at()`
];

async function runDirectMigration() {
    console.log('Running direct migration...');

    for (const [i, sql] of statements.entries()) {
        try {
            console.log(`Executing statement ${i + 1}/${statements.length}...`);
            await pool.query(sql);
            console.log('✅ Success');
        } catch (error) {
            console.error(`❌ Statement ${i + 1} failed:`, error.message);
            // Don't stop on drop errors?
            // Actually we want to see errors.
        }
    }

    console.log('Migration complete.');
    await pool.end();
}

runDirectMigration();
