const puppeteer = require('../backend/node_modules/puppeteer');
const { scrapeCategoryProducts } = require('../backend/instamart/categoryScraper');
const fs = require('fs');
const path = require('path');

const logFile = path.resolve(__dirname, '../debug_cat_product_log.txt');
const dlog = (m) => fs.appendFileSync(logFile, '[Test] ' + m + '\n');

async function test() {
    fs.writeFileSync(logFile, "Starting Category Product Test...\n");
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
        headless: true, // Change to false to see what's happening if needed
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set a reasonable viewport
    await page.setViewport({ width: 1366, height: 768 });

    // Use a URL from the sitemap
    const testUrl = 'https://www.swiggy.com/instamart/city/ahmedabad/c/fresh-vegetables';
    console.log(`Testing URL: ${testUrl}`);
    dlog(`Testing URL: ${testUrl}`);

    try {
        const products = await scrapeCategoryProducts(page, testUrl);
        console.log(`Found ${products.length} products.`);
        dlog(`Found ${products.length} products.`);

        if (products.length > 0) {
            console.log("Sample Product:", JSON.stringify(products[0], null, 2));
            dlog("Sample Product: " + JSON.stringify(products[0]));
        } else {
            console.log("No products found. Taking screenshot...");
            await page.screenshot({ path: 'instamart_cat_test_fail.png' });
            const content = await page.content();
            fs.writeFileSync('instamart_cat_test_fail.html', content);
        }

    } catch (e) {
        console.error("Error:", e);
        dlog("Error: " + e.message);
    } finally {
        await browser.close();
    }
}

test();
