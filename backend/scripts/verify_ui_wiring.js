const hybridScraper = require('../instamart/hybridScraper');
const fs = require('fs');
const path = require('path');

// Mock Puppeteer Page
const mockPage = {
    cookies: async () => [
        { name: 'test_cookie', value: 'test_value' }
    ],
    evaluate: async () => '1402948' // Mock Store ID
};

async function verifyWiring() {
    console.log("🧪 Testing UI Wiring (Node -> Python)...");

    // Use a category we know works (Fresh Fruits)
    // Note: With invalid cookies, API will likely fail and fallback to DOM
    // But we want to see the attempt to use Python.

    try {
        const products = await hybridScraper.scrapeCategoryProductsAuto(mockPage, 'Fresh Fruits', 'mumbai');
        console.log(`\n✅ Result: Got ${products.length} products`);

        if (products.length > 0) {
            console.log("Sample:", products[0]);
            if (products[0].skuId) {
                console.log("✅ Data structure looks correct (mapped from Python)");
            }
        }
    } catch (error) {
        console.error("❌ Test Failed (Expected if invalid cookies):");
        console.error("Type:", error.name);
        console.error("Message:", error.message);
        // Do NOT crash
    }
}

verifyWiring();
