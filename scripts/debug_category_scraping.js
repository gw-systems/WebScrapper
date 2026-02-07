const puppeteer = require('puppeteer');
const { scrapeCategoryProducts } = require('../backend/instamart/categoryScraper');
const fs = require('fs');

async function testCategoryScraping() {
    console.log("Starting test...");

    const browser = await puppeteer.launch({
        headless: false, // Show browser for debugging
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const categoryUrl = 'https://www.swiggy.com/instamart/city/ahmedabad/sc/dairy-bread-and-eggs/milk-6822eeeded32000001e25abe';

    console.log(`Testing URL: ${categoryUrl}`);

    // Navigate
    await page.goto(categoryUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    // Take screenshot
    await page.screenshot({ path: 'test_category_page.png' });
    console.log("Screenshot saved: test_category_page.png");

    // Check for JSON-LD
    const jsonLdData = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const results = [];
        for (const script of scripts) {
            try {
                results.push(JSON.parse(script.innerText));
            } catch (e) {
                results.push({ error: e.message });
            }
        }
        return results;
    });

    console.log("JSON-LD data:", JSON.stringify(jsonLdData, null, 2));

    // Check page content
    const pageInfo = await page.evaluate(() => {
        return {
            title: document.title,
            bodyText: document.body.innerText.substring(0, 500),
            imageCount: document.querySelectorAll('img').length,
            divCount: document.querySelectorAll('div').length,
            hasRupeeSymbol: document.body.innerText.includes('₹')
        };
    });

    console.log("Page info:", pageInfo);

    // Try the scraper
    console.log("\nTrying scrapeCategoryProducts...");
    const products = await scrapeCategoryProducts(page, categoryUrl);
    console.log(`Returned ${products.length} products`);

    if (products.length > 0) {
        console.log("First 3 products:", products.slice(0, 3));
    }

    await browser.close();
}

testCategoryScraping().catch(err => {
    console.error("Error:", err.message);
    console.error(err.stack);
});
