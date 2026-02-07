const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const PythonScraperAdapter = require('./instamart/pythonAdapter');

async function testScraper() {
    console.log('Starting Test Scraper...');
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false, // verification
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            ]
        });

        const page = await browser.newPage();

        // Use a known category
        const products = await PythonScraperAdapter.scrapeCategory(page, "Fresh Fruits", "mumbai");

        console.log(`\n✅ Scrape Success! Found ${products.length} products.`);
        if (products.length > 0) {
            console.log('Sample Product:', JSON.stringify(products[0], null, 2));
        } else {
            console.warn('⚠️ No products returned. Check if 403 or empty category.');
        }


    } catch (error) {
        console.error('\n❌ Scrape Failed:', error);
        require('fs').writeFileSync('test_scraper_error.log', error.stack || error.message);
    } finally {
        if (browser) await browser.close();
        console.log('Test Complete.');
    }
}

testScraper();
