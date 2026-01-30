const puppet = require("puppeteer");
const fs = require('fs');

async function debugSearchSnippets() {
    const browser = await puppet.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        const page = await browser.newPage();

        // Intercept responses
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('search') && (response.request().resourceType() === 'xhr' || response.request().resourceType() === 'fetch')) {
                try {
                    const json = await response.json();
                    if (json.response && json.response.snippets) {
                        console.log(`Captured search response from: ${url}`);
                        fs.writeFileSync('zepto_search_debug.json', JSON.stringify(json, null, 2));
                    }
                } catch (e) {
                    // Ignore non-json or failed parses
                }
            }
        });

        console.log("Navigating to Zepto results for 'oil'...");
        // Set a Mumbai lat/long if possible, or just go directly
        await page.goto("https://www.zeptonow.com/search?query=oil", { waitUntil: "networkidle2" });

        await new Promise(r => setTimeout(r, 10000));
        console.log("Finished waiting for any network activity.");

    } catch (err) {
        console.error("DEBUG ERROR:", err);
    } finally {
        await browser.close();
    }
}

debugSearchSnippets();
