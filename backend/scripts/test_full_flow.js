const puppet = require("puppeteer");
const { setZeptoLocation } = require('./zepto/set-location');
const { scrapeCategoryProducts } = require('./zepto/categoryScraper');
const { extractProductInformation } = require('./zepto/searchHelpers');

async function testLocationThenCategory() {
    console.log('=== Testing: Set Location → Scrape Category ===\n');

    const browser = await puppet.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Step 1: Set location to Mumbai
        console.log('STEP 1: Setting location to Mumbai...');
        const locationSet = await setZeptoLocation(page, "Mumbai");

        if (locationSet) {
            console.log(`✅ Location set successfully: ${locationSet}\n`);
        } else {
            console.log(`❌ Failed to set location\n`);
            await page.screenshot({ path: "location_failed.png" });
            return;
        }

        // Step 2: Verify localStorage has location data
        const locationData = await page.evaluate(() => {
            const userPosStr = localStorage.getItem('user-position');
            if (!userPosStr) return null;
            const userPos = JSON.parse(userPosStr);
            return {
                name: userPos.state?.userPosition?.name,
                latitude: userPos.state?.userPosition?.latitude,
                longitude: userPos.state?.userPosition?.longitude
            };
        });

        console.log('Location data in localStorage:');
        console.log(`  Name: ${locationData?.name}`);
        console.log(`  Coordinates: ${locationData?.latitude}, ${locationData?.longitude}\n`);

        // Step 3: Scrape a category
        console.log('STEP 2: Scraping Dairy > Milk category...');
        const testCategoryUrl = "https://www.zepto.com/cn/dairy-bread-eggs/milk/cid/4b938e02-7bde-4479-bc0a-2b54cb6bd5f5/scid/22964a2b-0439-4236-9950-0d71b532b243";

        const products = await scrapeCategoryProducts(page, testCategoryUrl);

        console.log(`\n=== RESULTS ===`);
        console.log(`Products found: ${products.length}`);

        if (products.length > 0) {
            console.log(`\n✅ SUCCESS! Category scraping works after setting location!`);
            console.log(`\nFirst 5 products:`);
            products.slice(0, 5).forEach((p, i) => {
                console.log(`${i + 1}. ${p.name}`);
                console.log(`   Price: ${p.price}`);
                console.log(`   Image: ${p.image ? 'Yes' : 'No'}`);
            });

            // Save all products to file
            const fs = require('fs');
            fs.writeFileSync('milk_products.json', JSON.stringify(products, null, 2));
            console.log(`\n📁 Saved ${products.length} products to milk_products.json`);
        } else {
            console.log(`\n❌ No products found even after setting location`);
        }

        await page.screenshot({ path: "category_scrape_success.png" });
        console.log(`\n📸 Screenshot saved: category_scrape_success.png`);

    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        await browser.close();
    }
}

testLocationThenCategory();
