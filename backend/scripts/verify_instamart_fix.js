const BrowserPool = require('../services/BrowserPool');
const { setInstamartLocation } = require('../instamart/set-location');

async function verifyFix() {
    console.log("Starting verification for Instamart fix...");

    try {
        console.log("Initializing Instamart browser (should be non-headless)...");
        // Use a dummy client ID
        const { browser, page } = await BrowserPool.getOrInitBrowser('test-client-id', 'instamart');

        console.log("Browser initialized. You should see a window open.");

        // Define a test location
        const location = "Bangalore";

        console.log(`Attempting to set location to: ${location}`);
        const result = await setInstamartLocation(page, location);

        if (result) {
            console.log("✅ SUCCESS: Location set successfully to " + result);
        } else {
            console.error("❌ FAILURE: Failed to set location.");
            console.log("Keeping browser open for inspection (soft failure)...");
            await new Promise(r => setTimeout(r, 600000));
        }

        // Keep it open for a moment to observe
        await new Promise(r => setTimeout(r, 10000));

        console.log("Closing browser...");
        await BrowserPool.closeBrowser('test-client-id', 'instamart');
        process.exit(0);

    } catch (error) {
        console.error("❌ ERROR:", error);
        console.log("Keeping browser open for inspection...");
        await new Promise(r => setTimeout(r, 600000)); // Keep open for 10 mins on error
        // process.exit(1); 
    }
}

verifyFix();
