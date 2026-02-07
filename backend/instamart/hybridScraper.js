/**
 * Hybrid Instamart Scraper (Python Integration)
 * 
 * Replaces old DOM/Node-API scrapers.
 * Now exclusively uses the Python Adapter to run `api_scraper.py`.
 */

const PythonScraperAdapter = require('./pythonAdapter');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// ============================================
// UTILITIES
// ============================================

/**
 * Extract category name from Instamart URL
 * Handles formats:
 * - /c/chips-and-namkeens
 * - /category-listing?categoryName=...
 * - /instamart/category/...
 */
function extractCategoryNameFromUrl(categoryUrl) {
    try {
        const url = new URL(categoryUrl, 'https://www.swiggy.com');

        // Check if it's already in /category-listing format with categoryName param
        const categoryNameParam = url.searchParams.get('categoryName');
        if (categoryNameParam) {
            return decodeURIComponent(categoryNameParam);
        }

        // Parse from path
        const pathParts = url.pathname.split('/').filter(Boolean);

        // Format: /c/chips-and-namkeens or /instamart/c/chips-and-namkeens
        const cIndex = pathParts.indexOf('c');
        if (cIndex !== -1 && pathParts[cIndex + 1]) {
            const slug = pathParts[cIndex + 1];
            // Remove 24-char ID if present at the end
            const cleaned = slug.replace(/-[a-z0-9]{24}$/i, '');
            // Convert kebab-case to Title Case
            return cleaned.split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        // Format: /instamart/category/chips-and-namkeens
        const categoryIndex = pathParts.indexOf('category');
        if (categoryIndex !== -1 && pathParts[categoryIndex + 1]) {
            const slug = pathParts[categoryIndex + 1];
            const cleaned = slug.replace(/-[a-z0-9]{24}$/i, '');
            return cleaned.split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        // Fallback: use last path part
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart !== 'instamart') {
            const cleaned = lastPart.replace(/-[a-z0-9]{24}$/i, '');
            return cleaned.split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        throw new Error('Could not extract category name from URL');
    } catch (error) {
        // If not a URL, return as is (might be name already)
        if (!categoryUrl.includes('http')) return categoryUrl;

        console.error('[URL PARSE ERROR]', error.message, categoryUrl);
        return categoryUrl; // Return original as best effort
    }
}

/**
 * Fetches all Instamart categories from the local source of truth
 * (Migrated from categoryScraper.js)
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

// ============================================
// MAIN SCRAPING FUNCTION
// ============================================

/**
 * Scrape category products using Python Adapter
 * (Strict Mode - No Fallback)
 */
async function scrapeCategoryProductsAuto(page, categoryUrlOrName, location = 'mumbai') {
    try {
        console.log('[HYBRID] Starting Scrape via Python Adapter...');

        let categoryName = categoryUrlOrName;
        // Clean URL if needed
        if (categoryUrlOrName.includes('http') || categoryUrlOrName.includes('/')) {
            categoryName = extractCategoryNameFromUrl(categoryUrlOrName);
        }

        console.log(`[HYBRID] Target Category: ${categoryName}`);

        // Scrape using Python
        const products = await PythonScraperAdapter.scrapeCategory(page, categoryName, location);

        // Transform to match UI expectations
        // The UI (Excel writer) expects specific keys like 'name', 'price', etc.
        return products.map(p => ({
            name: p.name,
            price: (p.offer_price).toString(),
            mrp: (p.mrp).toString(),
            quantity: p.quantity,
            weight: p.weight,
            image: p.primary_image,
            in_stock: p.in_stock,
            rating: 0, // Not captured by parser currently, default to 0

            // Context
            category: p.category,
            brand: p.brand,
            skuId: p.sku_id,
            discount: p.discount_percent + '%',

            // Compatibility flags
            available: p.in_stock
        }));

    } catch (error) {
        // Log error but DO NOT fallback to DOM (as requested by user)
        console.error('[HYBRID] Python Scraping Failed:', error.message);
        logger.error('Python scraping failed', { error: error.message });
        throw error; // Propagate error so UI shows "Failed" instead of hanging
    }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    getAllCategories,
    scrapeCategoryProductsAuto,

    // Kept for interface compatibility but maps to Python or throws
    scrapeCategoryProducts: async (page, url, loc, mode) => {
        return scrapeCategoryProductsAuto(page, url, loc);
    },

    // Stub utilities
    extractCookies: async () => { console.warn("extractCookies not implemented in new hybrid"); return {}; }
};
