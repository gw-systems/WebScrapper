const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { scrapeAndStore } = require('../scripts/scrapeAndStoreInstamart');
const logger = require('../utils/logger');

// GET /api/instamart/products
// List products with filtering
router.get('/products', async (req, res) => {
    try {
        const { category, search, inStock, limit = 50, offset = 0 } = req.query;

        let query = `
      SELECT id, sku_id, name, brand, category, 
             offer_price/100.0 as price, 
             mrp/100.0 as mrp, 
             discount_percent, 
             in_stock, 
             primary_image,
             scraped_at
      FROM products 
      WHERE 1=1
    `;

        const params = [];
        let paramIdx = 1;

        if (category) {
            query += ` AND category = $${paramIdx++}`;
            params.push(category);
        }

        if (search) {
            query += ` AND (name ILIKE $${paramIdx} OR brand ILIKE $${paramIdx})`;
            params.push(`%${search}%`);
            paramIdx++;
        }

        if (inStock === 'true') {
            query += ` AND in_stock = true`;
        }

        query += ` ORDER BY scraped_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Get total count (approximation for pagination)
        const countQuery = await pool.query('SELECT count(*) FROM products');

        res.json({
            success: true,
            count: result.rows.length,
            total: parseInt(countQuery.rows[0].count),
            data: result.rows
        });

    } catch (error) {
        logger.error('Error fetching products', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/instamart/categories
// List distinct categories
router.get('/categories', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT category, COUNT(*) as product_count, 
             MIN(scraped_at) as first_scraped,
             MAX(scraped_at) as last_scraped
      FROM products 
      GROUP BY category 
      ORDER BY product_count DESC
    `);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error fetching categories', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/instamart/jobs
// List recent scraping jobs
router.get('/jobs', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT * FROM scraping_jobs 
      WHERE service = 'instamart' 
      ORDER BY started_at DESC 
      LIMIT 20
    `);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error fetching jobs', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/instamart/scrape
// Trigger a new scraping job
router.post('/scrape', async (req, res) => {
    try {
        const { category } = req.body;

        if (!category) {
            return res.status(400).json({ success: false, error: 'Category is required' });
        }

        // Trigger scraping
        logger.info(`Starting manual scrape for: ${category}`);

        // We await for now, but in prod consider background processing
        const result = await scrapeAndStore(category);

        res.json({
            success: true,
            jobId: result.jobId,
            productsFound: result.productsCount,
            message: 'Scraping completed successfully'
        });

    } catch (error) {
        logger.error('Error triggering scrape', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
