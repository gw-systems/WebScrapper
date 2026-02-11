const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { scrapeAndStore } = require('../scripts/scrapeAndStoreInstamart');
const logger = require('../utils/logger');
const { validateQuery, validateBody } = require('../middleware/validation');

// GET /api/instamart/products
// List products with filtering
router.get('/products', validateQuery('productsQuery'), async (req, res) => {
    try {
        // req.query is now validated and sanitized
        const { category, search, inStock, limit, offset } = req.query;

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

        // Get estimated total count for performance (avoid slow COUNT(*))
        const countQuery = await pool.query("SELECT reltuples::bigint AS count FROM pg_class WHERE relname = 'products'");

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

// GET /api/instamart/jobs/:id
// Get status of a specific scraping job
router.get('/jobs/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT * FROM scraping_jobs WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        res.json({
            success: true,
            job: result.rows[0]
        });

    } catch (error) {
        logger.error('Error fetching job status', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/instamart/scrape
// Trigger a new scraping job (async - returns immediately)
router.post('/scrape', validateBody('scrapeBody'), async (req, res) => {
    try {
        const { category } = req.body;
        logger.info(`Starting manual scrape for: ${category}`);

        // Create job record immediately
        const jobResult = await pool.query(
            `INSERT INTO scraping_jobs (service, category, status, started_at) 
             VALUES ('instamart', $1, 'pending', NOW()) 
             RETURNING id`,
            [category]
        );

        const jobId = jobResult.rows[0].id;

        // Return immediately with jobId
        res.json({
            success: true,
            jobId: jobId,
            status: 'pending',
            message: 'Scraping job started. Poll GET /api/instamart/jobs/:id for status'
        });

        // Run scraping in background (don't await)
        scrapeAndStore(category, jobId).catch(err => {
            logger.error('Background scrape failed', { jobId, category, error: err.message });
        });

    } catch (error) {
        logger.error('Error triggering scrape', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
