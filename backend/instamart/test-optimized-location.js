/**
 * Test script for the new optimized Instamart location setter
 * Tests the pre-navigation cookie method
 */

const puppeteer = require('puppeteer');
const { setInstamartLocation } = require('./set-location');

async function testLocationSetting() {
    console.log('🚀 Testing Optimized Instamart Location Setting...\n');

    const browser = await puppeteer.launch({
        headless: false, // Set to true for headless mode
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1536, height: 864 });

        // Test locations
        const testLocations = [
            { name: 'Mumbai Central, Mumbai, Maharashtra, India', lat: 18.9690247, lng: 72.8205292 },
            { name: 'Bangalore Palace', lat: 12.9988, lng: 77.5921 },
            { name: 'Kolkata Park Street', lat: 22.5533, lng: 88.3515 }
        ];

        for (const loc of testLocations) {
            console.log(`\n📍 Testing location: ${loc.name}`);
            console.log(`   Coordinates: ${loc.lat}, ${loc.lng}`);
            console.log('   ⏱️  Starting timer...\n');

            const startTime = Date.now();

            const result = await setInstamartLocation(page, loc.name, loc.lat, loc.lng);

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

            if (result && result.location) {
                console.log(`   ✅ SUCCESS in ${elapsed}s`);
                console.log(`   📌 Location: ${result.location}`);
                if (result.storeId) {
                    console.log(`   🏪 Store ID: ${result.storeId}`);
                }
            } else {
                console.log(`   ❌ FAILED in ${elapsed}s`);
            }

            // Wait before next test
            await new Promise(r => setTimeout(r, 2000));
        }

        console.log('\n✨ All tests completed!\n');

    } catch (error) {
        console.error('❌ Test error:', error.message);
    } finally {
        await browser.close();
    }
}

// Run the test
testLocationSetting().catch(console.error);
