/**
 * Standalone Instamart Location Setting Test
 * Run this to test location setting independently
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { setInstamartLocation } = require('./set-location');

async function testInstamartLocation() {
    const location = process.argv[2] || 'mumbai';

    console.log('='.repeat(60));
    console.log('🧪 INSTAMART LOCATION SETTING TEST');
    console.log('='.repeat(60));
    console.log(`Location: ${location}`);
    console.log('');

    let browser;
    try {
        console.log('🌐 Launching browser (visible mode)...');
        browser = await puppeteer.launch({
            headless: false, // VISIBLE browser
            defaultViewport: null,
            args: [
                "--start-maximized",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled", // Hide automation
            ],
        });

        const page = await browser.newPage();

        // Set realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Override navigator.webdriver
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        console.log('🎯 Setting location...');
        console.log('');

        const result = await setInstamartLocation(page, location);

        if (result) {
            console.log('');
            console.log('✅ SUCCESS!');
            console.log('='.repeat(60));
            console.log(`Location: ${result.location || result}`);
            if (result.storeId) {
                console.log(`Store ID: ${result.storeId}`);
            }
            console.log('='.repeat(60));

            console.log('');
            console.log('⏳ Keeping browser open for 10 seconds so you can verify...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        } else {
            console.log('');
            console.log('❌ FAILED');
            console.log('='.repeat(60));
            console.log('Location setting did not complete successfully.');
            console.log('Check the browser window to see what went wrong.');
            console.log('Screenshots saved to project root for debugging.');
            console.log('='.repeat(60));

            console.log('');
            console.log('⏳ Keeping browser open for 30 seconds for manual inspection...');
            await new Promise(resolve => setTimeout(resolve, 30000));
        }

    } catch (error) {
        console.error('');
        console.error('💥 ERROR:', error.message);
        console.error('');
        if (browser) {
            console.log('⏳ Keeping browser open for 30 seconds for debugging...');
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run test
testInstamartLocation()
    .then(() => {
        console.log('');
        console.log('🏁 Test complete');
        process.exit(0);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
