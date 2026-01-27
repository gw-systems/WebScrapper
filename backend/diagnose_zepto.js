const puppet = require("puppeteer");
const path = require("path");

async function diagnoseZepto() {
    const browser = await puppet.launch({
        headless: false, // Set to false so we can see what's happening
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        console.log("Navigating to Zepto...");
        await page.goto("https://www.zeptonow.com/", { waitUntil: "networkidle2" });

        // 1. Check current location
        const locationText = await page.evaluate(() => {
            const el = document.querySelector('.max-w-\\[170px\\] > span');
            return el ? el.innerText : "Not found";
        });
        console.log("Current location text in UI:", locationText);

        // 2. Try to set location to Mumbai
        console.log("Attempting to set location to Mumbai...");
        try {
            await page.waitForSelector('.max-w-\\[170px\\] > span', { timeout: 5000 });
            await page.click('.max-w-\\[170px\\] > span');
            console.log("Clicked location button");

            await page.waitForSelector('[placeholder="Search a new address"]', { timeout: 5000 });
            await page.type('[placeholder="Search a new address"]', "Mumbai", { delay: 100 });
            console.log("Typed Mumbai");

            await new Promise(r => setTimeout(r, 2000));

            // Take a screenshot of suggestions
            await page.screenshot({ path: "zepto_suggestions.png" });
            console.log("Took screenshot of suggestions: zepto_suggestions.png");

            const suggestions = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.font-heading')).map(el => el.innerText);
            });
            console.log("Suggestions found:", suggestions);

            if (suggestions.length > 0) {
                await page.click('.flex:nth-child(1) > .ml-4 > div > .font-heading');
                console.log("Clicked first suggestion");

                await page.waitForSelector('.bg-skin-primary > .flex', { timeout: 5000 });
                await page.click('.bg-skin-primary > .flex');
                console.log("Clicked Confirm and Continue");

                await new Promise(r => setTimeout(r, 5000));

                // Check localStorage after setting location
                const locationData = await page.evaluate(() => {
                    const userPosStr = localStorage.getItem('user-position');
                    if (!userPosStr) return null;
                    return JSON.parse(userPosStr);
                });

                console.log("\n=== Location Data in localStorage ===");
                if (locationData) {
                    console.log("✅ user-position found!");
                    console.log("Location Name:", locationData.state?.userPosition?.name);
                    console.log("Latitude:", locationData.state?.userPosition?.latitude);
                    console.log("Longitude:", locationData.state?.userPosition?.longitude);
                    console.log("Address:", locationData.state?.userPosition?.shortAddress);
                } else {
                    console.log("❌ user-position NOT found in localStorage");
                }
                console.log("=====================================\n");
            }
        } catch (e) {
            console.log("Error during location setting:", e.message);
        }

        // 3. Search for Milk
        console.log("Searching for Milk...");
        await page.goto("https://www.zeptonow.com/search?query=milk", { waitUntil: "networkidle2" });

        await new Promise(r => setTimeout(r, 5000));

        // Check for product cards
        const products = await page.evaluate(() => {
            const cards = document.querySelectorAll('[data-testid="product-card"]');
            return Array.from(cards).map(card => {
                const name = card.querySelector('[data-testid="product-card-name"]')?.innerText;
                return name;
            });
        });

        console.log("Products found:", products.length);
        if (products.length > 0) {
            console.log("First 3 products:", products.slice(0, 3));
        } else {
            console.log("No products found. Checking page content...");
            const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
            console.log("Page Snippet:", bodyText);
        }

        await page.screenshot({ path: "zepto_search_results.png" });
        console.log("Took screenshot of search results: zepto_search_results.png");

    } catch (err) {
        console.error("DIAGNOSTIC ERROR:", err);
    } finally {
        await browser.close();
    }
}

diagnoseZepto();
