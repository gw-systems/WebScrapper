const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    location: 'Bangalore, Karnataka, India',
    outputFile: path.join(__dirname, '../scraped_data/instamart_categories.json'),
    headless: "new", // Robust headless mode
    defaultViewport: { width: 1920, height: 1080 }
};

async function scrapeCategories() {
    console.log('🚀 Starting Instamart Scraper...');

    // Launch with stealth-like args
    const browser = await puppeteer.launch({
        headless: CONFIG.headless,
        defaultViewport: CONFIG.defaultViewport,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"'
        ]
    });

    const page = await browser.newPage();

    // Anti-detection scripts
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    try {
        console.log('📍 Navigating to Swiggy...');
        await page.goto('https://www.swiggy.com/instamart', { waitUntil: 'networkidle2', timeout: 60000 });

        // Try setting location (UI)
        try {
            const locationSet = await setLocation(page);
            if (!locationSet) throw new Error("Location setting failed");

            console.log('📂 Navigating to Category Listing...');
            await page.goto('https://www.swiggy.com/instamart/category-listing', { waitUntil: 'networkidle2' });
            await page.waitForFunction(() => !!window.___INITIAL_STATE__, { timeout: 15000 });

            console.log('📥 Extracting Category Taxonomy...');
            const taxonomy = await page.evaluate(() => {
                const state = window.___INITIAL_STATE__;
                return state?.categoryListingV2?.data?.categories ||
                    state?.instamart?.categoryData?.categories ||
                    state?.homeV2?.data?.widgets?.find(w => w.type === 'IM_CATEGORY_GRID')?.data?.collection; // Fallback to home widgets
            });

            if (taxonomy) {
                console.log(`✅ Extracted ${taxonomy.length} categories from State.`);
                saveData(taxonomy);
                return;
            }
        } catch (innerErr) {
            console.warn(`⚠️ Primary extraction failed: ${innerErr.message}. Switch to Fallback.`);
        }

        // --- FALLBACK: Footer API ---
        console.log('🔄 Attempting Fallback: Footer API...');
        // We can fetch this directly in node, or via page
        const fallbackData = await page.evaluate(async () => {
            try {
                const res = await fetch('https://www.swiggy.com/api/instamart/im-footer');
                const json = await res.json();
                return json.data?.categories || null;
            } catch (e) { return null; }
        });

        if (fallbackData) {
            console.log(`✅ Extracted ${fallbackData.length} categories from Footer API.`);
            saveData(fallbackData);
        } else {
            throw new Error("All methods failed.");
        }

    } catch (error) {
        console.error('❌ Scraping Failed:', error);
        await page.screenshot({ path: path.join(__dirname, '../error_screenshot.png') });
    } finally {
        await browser.close();
    }
}

async function setLocation(page) {
    console.log('🌍 Setting Location...');
    // Simple robust flow: Check input -> if not, click header -> if input -> type -> select
    try {
        let input = await page.$('input[placeholder="Search for area, street name.."]');
        if (!input) {
            const header = await page.$('div[class*="_1z3-j"], span[class*="_3iLCN"]'); // Common classes
            if (header) {
                await header.click();
                await new Promise(r => setTimeout(r, 1000));
                input = await page.$('input[placeholder="Search for area, street name.."]');
            }
        }

        if (input) {
            await input.click({ clickCount: 3 });
            await input.press('Backspace');
            await input.type('Bangalore');
            await page.waitForSelector('div[class*="_1oLDb"]', { timeout: 5000 });
            const suggestions = await page.$$('div[class*="_1oLDb"]');
            if (suggestions.length > 0) {
                await suggestions[0].click();
                await new Promise(r => setTimeout(r, 3000));
                return true;
            }
        }
    } catch (e) {
        console.log('Location UI interaction issue:', e.message);
    }
    return false; // Could not confirm location set
}

function saveData(data) {
    const dir = path.dirname(CONFIG.outputFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(data, null, 2));
    console.log(`💾 Data saved to: ${CONFIG.outputFile}`);
}

scrapeCategories();
