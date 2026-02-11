/**
 * Scrape Instamart and Store in Database
 * Integrated workflow: Run Python scraper → Import to PostgreSQL
 */

const { spawn } = require('child_process');
const path = require('path');
const { pool } = require('../config/database');
const { importProducts } = require('./importInstamartProducts');

/**
 * Execute Python scraper and import results to database
 * @param {string} categoryName - Category to scrape (e.g., "Dairy, Bread and Eggs")
 * @param {string|number|null} sessionIdOrJobId - WebSocket session ID OR existing job ID
 * @returns {Promise<Object>} Scraping result with job ID and product count
 */
async function scrapeAndStore(categoryName, sessionIdOrJobId = null) {
    // Use shared pool
    let jobId = null;
    let sessionId = null;

    try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Starting Instamart scraping job`);
        console.log(`Category: ${categoryName}`);
        console.log(`${'='.repeat(60)}\n`);

        // Check if sessionIdOrJobId is a job ID (number) or session ID (string starting with 'ws-')
        if (typeof sessionIdOrJobId === 'number') {
            // Existing job ID provided (from REST API)
            jobId = sessionIdOrJobId;
            console.log(`📝 Using existing job ID: ${jobId}`);

            // Update status to running
            await pool.query(`
                UPDATE scraping_jobs 
                SET status = 'running'
                WHERE id = $1
            `, [jobId]);

        } else {
            // Create new job (for WebSocket or CLI)
            sessionId = sessionIdOrJobId;

            const jobResult = await pool.query(`
                INSERT INTO scraping_jobs (
                    session_id, service, job_type, search_term, status
                ) VALUES ($1, 'instamart', 'category', $2, 'in_progress')
                RETURNING id
            `, [sessionId, categoryName]);

            jobId = jobResult.rows[0].id;
            console.log(`📝 Created job ID: ${jobId}`);
        }

        // 2. Update Python config with category
        const configPath = path.join(__dirname, '../instamart/config.py');
        const fs = require('fs');
        let configContent = fs.readFileSync(configPath, 'utf-8');

        // Update CATEGORIES list
        const categoryConfig = `CATEGORIES = [\n    {"name": "${categoryName}", "taxonomyType": "Speciality taxonomy 1"},\n]`;
        configContent = configContent.replace(
            /CATEGORIES = \[[^\]]*\]/s,
            categoryConfig
        );

        fs.writeFileSync(configPath, configContent);
        console.log(`📝 Updated config.py with category`);

        // 3. Run Python scraper
        console.log(`\n🐍 Running Python scraper...`);

        const pythonScript = path.join(__dirname, '../instamart/api_scraper.py');
        const pythonProcess = spawn('python', [pythonScript], {
            cwd: path.join(__dirname, '../instamart')
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            process.stdout.write(data); // Stream output in real-time
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            process.stderr.write(data);
        });

        // Wait for Python to complete
        await new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Python scraper exited with code ${code}\n${stderr}`));
                }
            });
        });

        console.log(`\n✅ Python scraper completed`);

        // 4. Import scraped data to database
        console.log(`\n💾 Importing to database...`);

        const jsonFileName = categoryName
            .toLowerCase()
            .replace(/[, ]+/g, '_')
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9_]/g, '');

        const jsonPath = path.join(
            __dirname,
            '../instamart/scraped_data/instamart',
            `${jsonFileName}.json`
        );

        const productsCount = await importProducts(jsonPath, jobId);

        // 5. Update job as completed
        await pool.query(`
      UPDATE scraping_jobs 
      SET status = 'completed',
          products_found = $1,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [productsCount, jobId]);

        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ Job completed successfully!`);
        console.log(`   Job ID: ${jobId}`);
        console.log(`   Products: ${productsCount}`);
        console.log(`   JSON backup: ${jsonPath}`);
        console.log(`${'='.repeat(60)}\n`);

        return {
            success: true,
            jobId,
            productsCount,
            jsonPath
        };

    } catch (error) {
        console.error(`\n❌ Error:`, error.message);

        // Mark job as failed if it was created
        if (jobId) {
            await pool.query(`
        UPDATE scraping_jobs 
        SET status = 'failed',
            error_message = $1,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [error.message, jobId]);
        }

        throw error;

    }
    // Do NOT close shared pool here as it might be used by other concurrent requests
}

// CLI Usage
if (require.main === module) {
    const categoryName = process.argv[2];

    if (!categoryName) {
        console.log('Usage: node scrapeAndStoreInstamart.js "<category-name>"');
        console.log('\nExamples:');
        console.log('  node scrapeAndStoreInstamart.js "Dairy, Bread and Eggs"');
        console.log('  node scrapeAndStoreInstamart.js "Fresh Fruits"');
        process.exit(1);
    }

    // For CLI, we DO want to close the pool when done
    scrapeAndStore(categoryName)
        .then(async (result) => {
            console.log('Done!');
            await pool.end();
            process.exit(0);
        })
        .catch(async (error) => {
            console.error('Fatal error:', error);
            await pool.end();
            process.exit(1);
        });
}

module.exports = { scrapeAndStore };
