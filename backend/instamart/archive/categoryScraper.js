const fs = require('fs');
const path = require('path');

/**
 * Fetches all Instamart categories from the local source of truth
 * @param {Array<string>} excludedCategories - Categories to exclude
 * @returns {Promise<Array>} Categories with name and URL
 */
async function getAllCategories(excludedCategories = []) {
    try {
        console.log('Fetching Instamart categories from local JSON...');
        const jsonPath = path.resolve(__dirname, '../../scraped_data/instamart_full_categories.json');

        if (!fs.existsSync(jsonPath)) {
            console.error(`ERROR: Category file not found at ${jsonPath}`);
            return [];
        }

        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const uniqueCategories = JSON.parse(rawData);
        const allCategories = [];
        const excludedLower = excludedCategories.map(c => c.toLowerCase().trim());

        for (const cat of uniqueCategories) {
            const name = cat.name;
            let url = cat.url || (cat.exampleLink ? `https://www.swiggy.com${cat.exampleLink}` : '');

            const shouldExclude = excludedLower.some(ex => name.toLowerCase().includes(ex));

            if (!shouldExclude && url) {
                allCategories.push({ name, url, source: 'instamart' });
            }
        }

        console.log(`✅ Loaded ${allCategories.length} categories from local source.`);
        return allCategories;

    } catch (error) {
        console.error('Error fetching Instamart categories:', error.message);
        return [];
    }
}

/**
 * Scrapes products from a category page (Pure DOM Mode)
 * @param {Object} page - Puppeteer page
 * @param {string} categoryUrl
 * @param {string} location - User's location (legacy param, mostly unused as we trust session)
 */
async function scrapeCategoryProducts(page, categoryUrl, location = 'mumbai') {
    // URL Sanitization & Reconstruction
    // The source URLs are often broken permalinks (e.g. /sc/chocolates/...).
    // We must convert them to the working query-param format: /category-listing?categoryName=...
    let targetUrl = categoryUrl;

    // 1. Remove city if present
    if (targetUrl.includes('/city/')) {
        targetUrl = targetUrl.replace(/\/city\/[^/]+/, '');
    }

    // 2. Convert /sc/ or /c/ paths to category-listing query params
    // Pattern: .../sc/category-name/subcategory-name-FILTERID
    const pathMatch = targetUrl.match(/\/(?:sc|c)\/([^/]+)\/([^/]+)$/);
    if (pathMatch) {
        const rawCategory = pathMatch[1]; // e.g. "chocolates"
        const rawFilter = pathMatch[2];   // e.g. "milk-chocolates-6822..."

        // Extract Filter ID (last 24 hex chars)
        const filterIdMatch = rawFilter.match(/-([a-f0-9]{24})$/);

        if (filterIdMatch) {
            const filterId = filterIdMatch[1];

            // Format Names (kebab-case to Title Case)
            const fmtName = (s) => s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

            const categoryName = fmtName(rawCategory);
            // Remove ID from filter name
            const filterName = fmtName(rawFilter.replace(/-[a-f0-9]{24}$/, ''));

            // Construct valid URL
            // Custom encoder to use + instead of %20
            const encodePlus = (str) => encodeURIComponent(str).replace(/%20/g, '+');
            targetUrl = `https://www.swiggy.com/instamart/category-listing?categoryName=${encodePlus(categoryName)}&filterId=${filterId}&filterName=${encodePlus(filterName)}&offset=0&taxonomyType=Speciality+taxonomy+3`;

            console.log(`[DOM Scraper] Reconstructed URL: ${targetUrl}`);
        }
    }

    console.log(`[DOM Scraper] Starting scrape for: ${targetUrl}`);

    // 1. Navigate (Simple)
    try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (e) {
        console.warn(`[DOM Scraper] Navigation warning: ${e.message}. Continuing...`);
    }

    // 2. Handle Soft Blocks / Errors (The "Something went wrong" screen)
    await handleSoftBlock(page);

    // 3. Wait for content
    console.log("[DOM Scraper] Waiting for products to load...");
    try {
        // Wait for at least one product card container
        await page.waitForSelector('[data-testid="item-collection-card-full"]', { timeout: 15000 });
    } catch (e) {
        console.log("[DOM Scraper] Timeout waiting for products. Trying one more soft-block check...");
        await handleSoftBlock(page);
    }

    // 4. Extraction Loop
    let allProducts = [];
    let noChangeCount = 0;

    // Max 20 scrolls to prevent infinite loops (approx 200-300 products)
    const MAX_SCROLLS = 30;

    for (let i = 0; i < MAX_SCROLLS; i++) {
        // Extract current view
        const productsOnPage = await page.evaluate(() => {
            const cards = document.querySelectorAll('[data-testid="item-collection-card-full"]');
            return Array.from(cards).map(card => {
                try {
                    // Search for name and price with fallback strategies
                    // 1. Try data-testid (Best)
                    // 2. Try known CSS classes of the day
                    // 3. Try generic heuristics (text length, currency symbols)

                    const nameEl = card.querySelector('[data-testid="item-card-name"]') ||
                        card.querySelector('div[class*="iPErou"]') ||
                        card.querySelector('div[class*="_1lbNR"]');

                    const priceEl = card.querySelector('[data-testid="item-card-price"]') ||
                        card.querySelector('div[class*="_2jn41"]') ||
                        Array.from(card.querySelectorAll('div')).find(el => el.innerText.includes('₹') && el.innerText.length < 15);

                    const name = nameEl ? nameEl.innerText.trim() : null;
                    const priceText = priceEl ? priceEl.innerText.trim() : null; // "₹ 20"

                    // Cleanup price (remove ₹, trim)
                    const price = priceText ? priceText.replace(/[^\d.]/g, '') : null;

                    const image = card.querySelector('img')?.src;

                    // Quantity often in description or variant info. 
                    // Fallback to looking for text like "500 g" inside the card if no specific selector
                    const textContent = card.innerText;
                    const quantityMatch = textContent.match(/(\d+\s*(?:g|kg|ml|l|pcs|pc|units?))/i);
                    const quantity = quantityMatch ? quantityMatch[1] : '1 unit';

                    if (!name || !price) return null;

                    return {
                        name,
                        price,
                        image: image || '',
                        quantity,
                        source: 'instamart_dom'
                    };
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);
        });

        // Merge & Dedupe
        const prevLen = allProducts.length;
        productsOnPage.forEach(p => {
            if (!allProducts.some(existing => existing.name === p.name && existing.price === p.price)) {
                allProducts.push(p);
            }
        });

        const newLen = allProducts.length;
        console.log(`[DOM Scraper] Scroll ${i + 1}/${MAX_SCROLLS}: Found ${newLen} products (${newLen - prevLen} new)`);

        if (newLen === prevLen) {
            noChangeCount++;
        } else {
            noChangeCount = 0;
        }

        // Stop if no new products for 3 consecutive scrolls
        if (noChangeCount >= 3) {
            console.log("[DOM Scraper] No new products found for 3 scrolls. Stopping.");
            break;
        }

        // Scroll Down
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
        });

        // Wait for lazy load (randomized)
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

        // Check for error/retry button that might appear during scroll
        await handleSoftBlock(page);
    }

    return allProducts.map(p => ({
        ...p,
        id: `instamart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        available: true
    }));
}

/**
 * Helper to click "Retry" if the site throws a soft block
 */
async function handleSoftBlock(page) {
    try {
        const Clicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const retryBtn = buttons.find(b =>
                b.innerText.toLowerCase().includes('retry') ||
                b.innerText.toLowerCase().includes('try again') ||
                b.getAttribute('aria-label') === 'Retry'
            );

            if (retryBtn) {
                retryBtn.click();
                return true;
            }
            return false;
        });

        if (Clicked) {
            console.log("[DOM Scraper] Soft block detected! Clicked Retry. Waiting...");
            await new Promise(r => setTimeout(r, 3000));
        }
    } catch (e) {
        // Ignore errors during check
    }
}

module.exports = { getAllCategories, scrapeCategoryProducts };
