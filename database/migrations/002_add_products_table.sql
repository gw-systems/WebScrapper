-- Migration: Add Products Table for Instamart Scraped Data
-- Run: psql -U your_user -d webscrapper -f database/migrations/002_add_products_table.sql

-- Products table to store scraped product data
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  scraping_job_id INTEGER REFERENCES scraping_jobs(id) ON DELETE SET NULL,
  
  -- Product Identifiers
  sku_id VARCHAR(50) NOT NULL,
  spin_id VARCHAR(50),
  
  -- Basic Info
  name VARCHAR(500) NOT NULL,
  brand VARCHAR(255),
  category VARCHAR(255),
  super_category VARCHAR(255),
  sub_category VARCHAR(255),
  
  -- Pricing (stored in smallest currency unit - paise for INR)
  mrp INTEGER,
  offer_price INTEGER,
  discount INTEGER,
  discount_percent DECIMAL(5,2),
  unit_price VARCHAR(100),
  
  -- Quantity & Stock
  quantity VARCHAR(100),
  weight VARCHAR(100),
  in_stock BOOLEAN DEFAULT false,
  max_quantity INTEGER,
  
  -- Images (JSON array of URLs)
  images JSONB,
  primary_image TEXT,
  
  -- Description
  description TEXT,
  
  -- Metadata
  pod_id VARCHAR(50),
  weight_grams INTEGER,
  is_listing_variant BOOLEAN DEFAULT false,
  
  -- Timestamps
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint: same product on same day
  UNIQUE(sku_id, pod_id, DATE(scraped_at))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_job ON products(scraping_job_id);
CREATE INDEX IF NOT EXISTS idx_products_scraped ON products(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON products(in_stock) WHERE in_stock = true;

-- Full text search on product names
CREATE INDEX IF NOT EXISTS idx_products_name_search ON products USING gin(to_tsvector('english', name));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_products_timestamp
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

-- Comments
COMMENT ON TABLE products IS 'Stores scraped product data from Instamart';
COMMENT ON COLUMN products.sku_id IS 'Unique SKU identifier from Instamart';
COMMENT ON COLUMN products.pod_id IS 'Store/location identifier (storeId)';
COMMENT ON COLUMN products.images IS 'JSON array of image URLs';
COMMENT ON COLUMN products.discount_percent IS 'Discount percentage (0-100)';
