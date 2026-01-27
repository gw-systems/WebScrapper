const puppet = require("puppeteer");
const { scrapeCategoryProducts } = require('./zepto/categoryScraper');
const { extractProductInformation } = require('./zepto/searchHelpers');

async function testCategoryScraping() {
    console.log('Testing Zepto category scraping WITHOUT setting location...\n');

    const browser = await puppet.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Test category: Dairy > Milk (a popular category)
        const testCategoryUrl = "https://www.zepto.com/cn/dairy-bread-eggs/milk/cid/4b938e02-7bde-4479-bc0a-2b54cb6bd5f5/scid/22964a2b-0439-4236-9950-0d71b532b243";

        console.log(`Testing category: Dairy > Milk`);
        console.log(`URL: ${testCategoryUrl}\n`);

        // Scrape without setting location
        const products = await scrapeCategoryProducts(page, testCategoryUrl, extractProductInformation);

        console.log(`\n=== RESULTS ===`);
        console.log(`Products found: ${products.length}`);

        if (products.length > 0) {
            console.log(`\n✅ SUCCESS! Products were scraped WITHOUT setting location!`);
            console.log(`\nFirst 3 products:`);
            products.slice(0, 3).forEach((p, i) => {
                console.log(`${i + 1}. ${p.name} - ${p.price}`);
            });
        } else {
            console.log(`\n❌ HYPOTHESIS CONFIRMED: No products found without location!`);
            console.log(`\nChecking what the page shows...`);

            const pageContent = await page.evaluate(() => {
                return {
                    title: document.title,
                    bodyText: document.body.innerText.substring(0, 500),
                    hasLocationPrompt: document.body.innerText.toLowerCase().includes('location') ||
                        document.body.innerText.toLowerCase().includes('select') ||
                        document.body.innerText.toLowerCase().includes('delivery')
                };
            });

            console.log('Page title:', pageContent.title);
            console.log('Has location prompt:', pageContent.hasLocationPrompt);
            console.log('\nPage snippet:', pageContent.bodyText);
        }

        await page.screenshot({ path: "zepto_category_test.png" });
        console.log(`\nScreenshot saved: zepto_category_test.png`);

    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        await browser.close();
    }
}

testCategoryScraping();
