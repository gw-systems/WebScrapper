const { getAllCategories, scrapeCategoryProducts } = require('../instamart/categoryScraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { setInstamartLocation } = require('../instamart/set-location');

puppeteer.use(StealthPlugin());

async function test() {
    console.log("Testing Instamart Category Scraper...");

    // 1. Test Sitemap
    // const categories = await getAllCategories();
    // console.log(`Fetched ${categories.length} categories.`);
    // if (categories.length > 0) {
    //     console.log("Sample:", categories[0]);
    // }

    // 2. Test Product Scraping
    const browser = await puppeteer.launch({
        headless: false, // Visible for testing
        defaultViewport: null,
        args: ['--start-maximized']
    });

    try {
        const page = await browser.newPage();

        // Set Location
        await setInstamartLocation(page, "Mumbai");

        // Scrape a specific category
        // Use a known URL or one from the sitemap
        const testUrl = "https://www.swiggy.com/instamart/category-listing?categoryName=Fresh%20Vegetables&taxonomyType=All%20Listing";

        const products = await scrapeCategoryProducts(page, testUrl);

        console.log(`Scraped ${products.length} products.`);
        console.log("Sample Products:", JSON.stringify(products.slice(0, 3), null, 2));

    } catch (e) {
        console.error("Test Failed:", e);
    } finally {
        await browser.close();
    }
}

test();
