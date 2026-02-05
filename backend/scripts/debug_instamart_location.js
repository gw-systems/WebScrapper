const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    console.log("Launching browser (non-headless)...");
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1536, height: 695 });

    console.log("Navigating to Instamart...");
    await page.goto("https://www.swiggy.com/instamart", { waitUntil: "domcontentloaded" });
    await new Promise(r => setTimeout(r, 3000));

    console.log("Looking for location entry points...");

    // Check what selectors are available
    const selectors = [
        '[data-testid="search-location"]',
        '[data-testid="address-name"]',
        '[data-testid="DEFAULT_ADDRESS_CONTAINER"]',
        '[data-testid="DEFAULT_ADDRESS_TITLE"]'
    ];

    for (const sel of selectors) {
        const found = await page.$(sel);
        console.log(`${sel}: ${found ? 'FOUND' : 'NOT FOUND'}`);
    }

    // Click on DEFAULT_ADDRESS_CONTAINER or DEFAULT_ADDRESS_TITLE
    console.log("\nClicking on 'Add your location'...");
    try {
        const titleEl = await page.$('[data-testid="DEFAULT_ADDRESS_TITLE"]');
        if (titleEl) {
            await titleEl.click();
            console.log("Clicked DEFAULT_ADDRESS_TITLE");
        } else {
            const containerEl = await page.$('[data-testid="DEFAULT_ADDRESS_CONTAINER"]');
            if (containerEl) {
                await containerEl.click();
                console.log("Clicked DEFAULT_ADDRESS_CONTAINER");
            }
        }
    } catch (e) {
        console.log("Error clicking location entry:", e.message);
    }

    await new Promise(r => setTimeout(r, 2000));
    console.log("\nAfter clicking, looking for elements in modal...");

    // Check what's available now
    const modalSelectors = [
        '[data-testid="search-location"]',
        'input._1wkJd',
        'input[placeholder*="Search"]',
        'input[type="text"]',
        '.gwpTv input'
    ];

    for (const sel of modalSelectors) {
        const found = await page.$(sel);
        console.log(`${sel}: ${found ? 'FOUND' : 'NOT FOUND'}`);
    }

    // Now click on search-location if found
    console.log("\nClicking on 'Search for an area or address'...");
    try {
        const searchLocationDiv = await page.$('[data-testid="search-location"]');
        if (searchLocationDiv) {
            await searchLocationDiv.click();
            console.log("Clicked search-location div");
            await new Promise(r => setTimeout(r, 2000));

            console.log("\nAfter clicking search-location, looking for input...");
            for (const sel of modalSelectors) {
                const found = await page.$(sel);
                console.log(`${sel}: ${found ? 'FOUND' : 'NOT FOUND'}`);
            }
        } else {
            console.log("search-location div NOT found");
        }
    } catch (e) {
        console.log("Error clicking search-location:", e.message);
    }

    // Keep browser open for manual inspection
    console.log("\n=== Browser will stay open for 60 seconds for manual inspection ===");
    console.log("Please inspect the page and find the correct input selector.");
    await new Promise(r => setTimeout(r, 60000));

    console.log("Closing browser...");
    await browser.close();
}

run().catch(console.error);
