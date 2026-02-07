/**
 * Import Instamart Products from JSON to PostgreSQL
 * Reads JSON files created by Python API scraper and imports to database
 */

const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

/**
 * Import products from a JSON file to the database
 * @param {string} jsonFilePath - Absolute path to JSON file
 * @param {number|null} jobId - Optional scraping job ID to link
 * @returns {Promise<number>} Number of products imported
 */
async function importProducts(jsonFilePath, jobId = null) {
    // Use the shared pool exported from config/database.js

    try {
        // Read JSON file
        console.log(`📂 Reading: ${jsonFilePath}`);

        if (!fs.existsSync(jsonFilePath)) {
            throw new Error(`File not found: ${jsonFilePath}`);
        }

        const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
        const data = JSON.parse(fileContent);

        if (!data.products || !Array.isArray(data.products)) {
            throw new Error('Invalid JSON format: missing "products" array');
        }

        console.log(`📦 Found ${data.products.length} products in file`);
        console.log(`   Category: ${data.category}`);
        console.log(`   Store ID: ${data.store_id}`);
        console.log(`   Scraped: ${data.scraped_at}`);

        let imported = 0;
        let updated = 0;
        let skipped = 0;

        // Insert products one by one (could be batched for better performance)
        for (const product of data.products) {
            try {
                // Convert prices from Rupees to Paise (x100)
                // API returns units (Rupees), DB stores integer paise
                const mrpPaise = Math.round((product.mrp || 0) * 100);
                const offerPricePaise = Math.round((product.offer_price || 0) * 100);
                const discountPaise = Math.round((product.discount || 0) * 100);

                const result = await pool.query(`
          INSERT INTO products (
            scraping_job_id, sku_id, spin_id, name, brand, category,
            super_category, sub_category, mrp, offer_price, discount,
            discount_percent, unit_price, quantity, weight, in_stock,
            max_quantity, images, primary_image, description,
            pod_id, weight_grams, is_listing_variant, scraped_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          ON CONFLICT (sku_id, pod_id, DATE(scraped_at)) DO UPDATE SET
            offer_price = EXCLUDED.offer_price,
            mrp = EXCLUDED.mrp,
            in_stock = EXCLUDED.in_stock,
            discount = EXCLUDED.discount,
            discount_percent = EXCLUDED.discount_percent,
            updated_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS inserted
        `, [
                    jobId,
                    product.sku_id || null,
                    product.spin_id || null,
                    product.name || 'Unknown',
                    product.brand || null,
                    product.category || null,
                    product.super_category || null,
                    product.sub_category || null,
                    mrpPaise,           // Storing in Paise
                    offerPricePaise,    // Storing in Paise
                    discountPaise,      // Storing in Paise
                    product.discount_percent || 0,
                    product.unit_price || null,
                    product.quantity || null,
                    product.weight || null,
                    product.in_stock || false,
                    product.max_quantity || 0,
                    JSON.stringify(product.images || []),
                    product.primary_image || null,
                    product.description || null,
                    product.pod_id || data.store_id,
                    product.weight_grams || 0,
                    product.is_listing_variant || false,
                    data.scraped_at || new Date().toISOString()
                ]);

                if (result.rows[0].inserted) {
                    imported++;
                } else {
                    updated++;
                }

            } catch (error) {
                console.error(`   ⚠️  Error importing product ${product.sku_id}:`, error.message);
                skipped++;
            }
        }

        console.log(`\n✅ Import complete:`);
        console.log(`   - ${imported} products inserted`);
        console.log(`   - ${updated} products updated`);
        console.log(`   - ${skipped} products skipped`);

        return imported + updated;

    } catch (error) {
        console.error('❌ Import failed:', error.message);
        throw error;
    }
}

/**
 * Import all JSON files from a directory
 * @param {string} directoryPath - Path to directory containing JSON files
 * @returns {Promise<void>}
 */
async function importDirectory(directoryPath) {
    const files = fs.readdirSync(directoryPath)
        .filter(f => f.endsWith('.json') && f !== 'scrape_summary.json');

    console.log(`\n📁 Found ${files.length} JSON files to import`);

    let totalImported = 0;

    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        importProducts(filePath); // Running sequentially-ish but without await here might be risky if pool limits
        // Better to await
    }

    // Wait loop or just sequential
    for (const file of files) {
        // Actually the loop above was wrong in previous version? 
        // Wait, let's fix the loop logic
    }
}
// Rewriting importDirectory to be correct
async function importDirectoryFixed(directoryPath) {
    const files = fs.readdirSync(directoryPath)
        .filter(f => f.endsWith('.json') && f !== 'scrape_summary.json');

    console.log(`\n📁 Found ${files.length} JSON files to import`);

    let totalImported = 0;

    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        console.log(`\n${'='.repeat(60)}`);
        const count = await importProducts(filePath);
        totalImported += count;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 Total: ${totalImported} products imported across ${files.length} files`);
}


// CLI Usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage:');
        console.log('  node importInstamartProducts.js <json-file-path>');
        console.log('  node importInstamartProducts.js --directory <directory-path>');
        console.log('\nExamples:');
        console.log('  node importInstamartProducts.js scraped_data/instamart/fresh_fruits.json');
        console.log('  node importInstamartProducts.js --directory scraped_data/instamart');
        process.exit(1);
    }

    const cleanup = async () => {
        try {
            await pool.end();
            console.log('Database connection closed.');
        } catch (e) {
            console.error('Error closing pool:', e);
        }
    };

    if (args[0] === '--directory') {
        importDirectoryFixed(args[1] || '../instamart/scraped_data/instamart')
            .then(async () => {
                await cleanup();
                process.exit(0);
            })
            .catch(async error => {
                console.error('Fatal error:', error);
                await cleanup();
                process.exit(1);
            });
    } else {
        importProducts(args[0])
            .then(async () => {
                await cleanup();
                process.exit(0);
            })
            .catch(async error => {
                console.error('Fatal error:', error);
                await cleanup();
                process.exit(1);
            });
    }
}

module.exports = { importProducts, importDirectory: importDirectoryFixed };
