const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { setInstamartLocation } = require('./set-location'); // Use proven location setter

/**
 * Automated Cookie Extractor for Instamart
 * Uses Puppeteer to automatically extract fresh cookies and storeId
 * No manual DevTools required!
 */

const COOKIE_FILE = path.join(__dirname, 'cookies.json');

/**
 * Extract cookies and session data from Instamart using Puppeteer
 * @param {string} location - Location to set (e.g., "Mumbai Central, Mumbai")
 * @returns {Promise<Object>} Cookie data and storeId
 */
async function extractCookies(location = 'Mumbai Central, Mumbai') {
    console.log('[COOKIE EXTRACTOR] Starting browser...');

    const browser = await puppeteer.launch({
        headless: false, // Show browser for location setting
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set viewport
        await page.setViewport({ width: 1280, height: 800 });

        console.log('[COOKIE EXTRACTOR] Navigating to Instamart...');
        await page.goto('https://www.swiggy.com/instamart', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait a bit for the page to fully load
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('[COOKIE EXTRACTOR] Setting location using proven location setter...');

        // Use the existing, proven location-setting logic
        let locationResult;
        try {
            locationResult = await setInstamartLocation(page, location);

            if (!locationResult) {
                throw new Error('Location setting failed - verification did not pass');
            }

            console.log(`[COOKIE EXTRACTOR] ✅ Location set to: ${locationResult.location || locationResult}`);

        } catch (error) {
            console.error('[COOKIE EXTRACTOR] Location setting error:', error.message);
            throw new Error(`Failed to set location: ${error.message}`);
        }

        // Extract storeId from location result (if available)
        let storeId = null;
        let primaryStoreId = null;
        let secondaryStoreId = null;

        if (locationResult && locationResult.storeId) {
            storeId = locationResult.storeId;
            primaryStoreId = storeId;
            console.log(`[COOKIE EXTRACTOR] Got storeId from location result: ${storeId}`);
        }

        // Fallback: Try to get storeId from URL or network requests
        if (!storeId) {
            console.log('[COOKIE EXTRACTOR] No storeId in location result, trying to extract from page...');

            // Set up network listener
            page.on('request', request => {
                const url = request.url();
                if (url.includes('category-listing')) {
                    const urlObj = new URL(url);
                    if (!storeId) storeId = urlObj.searchParams.get('storeId');
                    if (!primaryStoreId) primaryStoreId = urlObj.searchParams.get('primaryStoreId');
                    if (!secondaryStoreId) secondaryStoreId = urlObj.searchParams.get('secondaryStoreId');
                }
            });

            // Navigate to a category to trigger the API request
            console.log('[COOKIE EXTRACTOR] Navigating to category page to get storeId...');

            // Click on any category to trigger the API request
            try {
                await page.waitForSelector('[class*="category" i] a, [class*="tile" i] a', { timeout: 10000 });
                const categoryLink = await page.$('[class*="category" i] a, [class*="tile" i] a');
                if (categoryLink) {
                    await categoryLink.click();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } catch (error) {
                console.log('[COOKIE EXTRACTOR] Could not find category link, continuing...');
            }

            // If storeId not found from request, try to extract from URL
            if (!storeId) {
                const currentUrl = page.url();
                const urlMatch = currentUrl.match(/storeId=(\d+)/);
                if (urlMatch) {
                    storeId = urlMatch[1];
                    primaryStoreId = storeId;
                }
            }
        }

        console.log('[COOKIE EXTRACTOR] Extracting cookies...');

        // Get all cookies
        const cookies = await page.cookies();

        // Convert to cookie string format (like in DevTools)
        const cookieString = cookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');

        // Extract key cookies
        const keyCookies = {};
        cookies.forEach(cookie => {
            keyCookies[cookie.name] = cookie.value;
        });

        // Get user agent
        const userAgent = await page.evaluate(() => navigator.userAgent);

        // Prepare cookie data
        const cookieData = {
            cookieString: cookieString,
            cookies: cookies,
            keyCookies: keyCookies,
            storeId: storeId || '1135722', // Default Mumbai store
            primaryStoreId: primaryStoreId || storeId || '1135722',
            secondaryStoreId: secondaryStoreId || '1396282',
            userAgent: userAgent,
            extractedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
        };

        console.log('[COOKIE EXTRACTOR] ✅ Extraction complete!');
        console.log(`[COOKIE EXTRACTOR] StoreId: ${cookieData.storeId}`);
        console.log(`[COOKIE EXTRACTOR] Cookies: ${cookies.length} found`);
        console.log(`[COOKIE EXTRACTOR] Valid until: ${new Date(cookieData.expiresAt).toLocaleString()}`);

        return cookieData;

    } finally {
        await browser.close();
    }
}

/**
 * Save cookie data to file
 */
function saveCookies(cookieData) {
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookieData, null, 2));
    console.log(`[COOKIE EXTRACTOR] 💾 Saved to: ${COOKIE_FILE}`);
}

/**
 * Load cookie data from file
 * @returns {Object|null} Cookie data or null if not found/expired
 */
function loadCookies() {
    if (!fs.existsSync(COOKIE_FILE)) {
        console.log('[COOKIE EXTRACTOR] No saved cookies found.');
        return null;
    }

    try {
        const data = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));

        // Check if expired
        const expiresAt = new Date(data.expiresAt);
        const now = new Date();

        if (now >= expiresAt) {
            console.log('[COOKIE EXTRACTOR] ⚠️  Saved cookies expired.');
            return null;
        }

        console.log('[COOKIE EXTRACTOR] ✅ Loaded valid cookies from file.');
        console.log(`[COOKIE EXTRACTOR] Expires: ${expiresAt.toLocaleString()}`);
        return data;

    } catch (error) {
        console.error('[COOKIE EXTRACTOR] Error loading cookies:', error.message);
        return null;
    }
}

/**
 * Get fresh cookies (load from file or extract new ones)
 * @param {boolean} forceRefresh - Force extraction even if valid cookies exist
 * @param {string} location - Location for extraction
 * @returns {Promise<Object>} Cookie data
 */
async function getCookies(forceRefresh = false, location = 'Mumbai Central, Mumbai') {
    if (!forceRefresh) {
        const saved = loadCookies();
        if (saved) {
            return saved;
        }
    }

    console.log('[COOKIE EXTRACTOR] Extracting fresh cookies...');
    const cookieData = await extractCookies(location);
    saveCookies(cookieData);
    return cookieData;
}

// ============================================
// CLI USAGE
// ============================================

async function main() {
    try {
        console.log('========================================');
        console.log('Instamart Cookie Extractor');
        console.log('========================================\n');

        const forceRefresh = process.argv.includes('--refresh');
        const location = process.argv.find(arg => arg.startsWith('--location='))?.split('=')[1]
            || 'Mumbai Central, Mumbai';

        const cookieData = await getCookies(forceRefresh, location);

        console.log('\n========================================');
        console.log('✅ Cookie extraction successful!');
        console.log('========================================');
        console.log(`StoreId: ${cookieData.storeId}`);
        console.log(`Valid until: ${new Date(cookieData.expiresAt).toLocaleString()}`);
        console.log(`Saved to: ${COOKIE_FILE}`);
        console.log('\nNow you can run: node backend/instamart/apiScraper.js');

    } catch (error) {
        console.error('\n❌ Cookie extraction failed:', error.message);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    extractCookies,
    saveCookies,
    loadCookies,
    getCookies,
    COOKIE_FILE
};
