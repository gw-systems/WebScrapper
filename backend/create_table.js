const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'webscrapper',
    user: 'webscrapper_user',
    password: 'dev_password_123'
});

const createTableSql = `
CREATE TABLE products (
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
)`;

async function createTable() {
    try {
        console.log('Creating table `products`...');
        await pool.query(createTableSql);
        console.log('✅ Table created successfully!');
    } catch (error) {
        console.error('❌ Failed to create table:');
        console.error(error.message);
        if (error.detail) console.error('Detail:', error.detail);
        if (error.hint) console.error('Hint:', error.hint);
    } finally {
        await pool.end();
    }
}

createTable();
