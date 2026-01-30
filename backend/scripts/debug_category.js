const puppet = require("puppeteer");
const { setZeptoLocation } = require('./zepto/set-location');

async function debugCategoryPage() {
    console.log('=== Debugging Category Page ===\n');

    const browser = await puppet.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Step 1: Set location
        console.log('Setting location to Mumbai...');
        await setZeptoLocation(page, "Mumbai");

        // Step 2: Navigate to category
        const categoryUrl = "https://www.zepto.com/cn/dairy-bread-eggs/milk/cid/4b938e02-7bde-4479-bc0a-2b54cb6bd5f5/scid/22964a2b-0439-4236-9950-0d71b532b243";
        console.log(`\nNavigating to: ${categoryUrl}`);

        await page.goto(categoryUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await new Promise(r => setTimeout(r, 5000)); // Wait longer

        // Debug: Check what's on the page
        const pageInfo = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                productCards: document.querySelectorAll('[data-testid="product-card"]').length,
                bodySnippet: document.body.innerText.substring(0, 500),
                allTestIds: Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid')).slice(0, 20)
            };
        });

        console.log('\n=== Page Information ===');
        console.log('Title:', pageInfo.title);
        console.log('URL:', pageInfo.url);
        console.log('Product cards found:', pageInfo.productCards);
        console.log('\nAll data-testid attributes found:', pageInfo.allTestIds);
        console.log('\nBody snippet:', pageInfo.bodySnippet);

        await page.screenshot({ path: "debug_category_page.png", fullPage: true });
        console.log('\n📸 Full page screenshot saved: debug_category_page.png');

        // Wait so you can inspect manually
        console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
        await new Promise(r => setTimeout(r, 30000));

    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        await browser.close();
    }
}

debugCategoryPage();
