const puppet = require("puppeteer");
const fs = require('fs');

async function debugSearchSnippets() {
    console.log("Starting diagnostic...");
    const browser = await puppet.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        const page = await browser.newPage();

        // Intercept responses
        page.on('response', async (response) => {
            const url = response.url();
            try {
                const contentType = response.headers()['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    const json = await response.json().catch(() => null);
                    if (json && json.response && json.response.snippets) {
                        console.log(`\nCAPTURED JSON from: ${url}`);
                        const filename = `debug_json_${Date.now()}.json`;
                        fs.writeFileSync(filename, JSON.stringify(json, null, 2));
                        console.log(`Saved to ${filename}`);

                        // Check if it has the problematic keywords
                        const contentStr = JSON.stringify(json).toLowerCase();
                        if (contentStr.includes('feminine') || contentStr.includes('hygiene')) {
                            console.log("!!! FOUND 'feminine hygiene' in this JSON !!!");
                        }
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        });

        console.log("Navigating to Zepto search page for 'oil'...");
        // Directly go to search URL
        await page.goto("https://www.zeptonow.com/search?query=oil", { waitUntil: "networkidle2" });

        // Scroll a bit to trigger lazy loading or more requests
        console.log("Scrolling...");
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 5000));
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 5000));

        console.log("Finished waiting.");

    } catch (err) {
        console.error("DIAGNOSTIC ERROR:", err);
    } finally {
        await browser.close();
    }
}

debugSearchSnippets();
