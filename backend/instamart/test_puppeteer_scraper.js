const puppeteer = require('puppeteer');
const scraper = require('./categoryScraper');
const path = require('path');
const fs = require('fs');

async function runTest() {
    console.log('Starting Instamart Scraper Test...');

    let browser;
    let page;
    try {
        browser = await puppeteer.launch({
            headless: true, // Switched to true for background execution
            defaultViewport: { width: 1280, height: 800 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        page = await browser.newPage();

        // 1. Set Location
        const locationSuccess = await scraper.setLocationUI(page, 'Mumbai Central');
        if (!locationSuccess) {
            console.error('Failed to set location. Exiting.');
            const screenshotPath = path.join(__dirname, 'location_fail_screenshot.png');
            await page.screenshot({ path: screenshotPath });
            console.log(`Location failure screenshot saved to: ${screenshotPath}`);
            return;
        }

        // 2. Scrape Category
        // Using "Fresh Fruits" as a test category
        const testCategoryUrl = 'https://www.swiggy.com/instamart/category-listing?categoryName=Fresh%20Fruits';
        const products = await scraper.scrapeCategoryProducts(page, testCategoryUrl);

        console.log(`Test Result: Found ${products.length} products.`);

        if (products.length > 0) {
            console.log('First 3 products:');
            console.log(JSON.stringify(products.slice(0, 3), null, 2));

            // Save to debug file
            const debugPath = path.join(__dirname, 'scraped_data/test_output.json');
            if (!fs.existsSync(path.dirname(debugPath))) {
                fs.mkdirSync(path.dirname(debugPath), { recursive: true });
            }
            fs.writeFileSync(debugPath, JSON.stringify(products, null, 2));
            console.log(`Full output saved to: ${debugPath}`);
        } else {
            console.warn('No products found. Extraction might be failing.');
        }

    } catch (error) {
        console.error('Test failed with error:', error);
        if (page) {
            const screenshotPath = path.join(__dirname, 'error_screenshot.png');
            await page.screenshot({ path: screenshotPath });
            console.log(`Error screenshot saved to: ${screenshotPath}`);
        }
    } finally {
        if (browser) {
            console.log('Closing browser in 10 seconds...');
            setTimeout(async () => {
                await browser.close();
                process.exit(0);
            }, 10000);
        }
    }
}

runTest();
