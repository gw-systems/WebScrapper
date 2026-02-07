/**
 * API-Only Instamart Scraper
 * 
 * Pure API-based scraping - NO DOM manipulation
 * Requires valid cookies from cookieExtractor
 */

const { getCookies } = require('./cookieExtractor');
const { fetchCategoryProducts, extractProducts } = require('./apiScraper');
const logger = require('../utils/logger');

// ============================================
// URL PARSING
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
        console.error('[URL PARSE ERROR]', error.message, categoryUrl);
        throw new Error(`Cannot extract category name from URL: ${categoryUrl}`);
    }
}

// ============================================
// API SCRAPING
// ============================================

/**
 * Scrape category products using API mode (FAST!)
 */
async function scrapeCategoryProductsAPI(categoryUrlOrName, location = 'mumbai') {
    try {
        // Extract category name from URL if needed
        let categoryName = categoryUrlOrName;
        if (categoryUrlOrName.includes('http') || categoryUrlOrName.includes('/')) {
            categoryName = extractCategoryNameFromUrl(categoryUrlOrName);
            console.log(`[API MODE] Extracted category name: "${categoryName}" from URL`);
        }

        console.log(`[API MODE] Scraping ${categoryName}...`);

        // Ensure we have valid cookies (auto-extract if missing)
        let cookieData;
        try {
            cookieData = await getCookies(false, location); // Try loading saved cookies
        } catch (error) {
            // If no saved cookies, auto-extract them
            console.log('[API MODE] No saved cookies found, auto-extracting...');
            try {
                cookieData = await getCookies(true, location); // Force extraction
            } catch (extractError) {
                throw new Error(`Auto cookie extraction failed: ${extractError.message}. Please set location first.`);
            }
        }

        const allProducts = [];
        let offset = 0;
        let hasMore = true;
        let pageCount = 0;
        const maxPages = 20; // Safety limit

        while (hasMore && pageCount < maxPages) {
            try {
                // Fetch page via API
                const response = await fetchCategoryProducts(categoryName, offset);
                const products = extractProducts(response);

                if (products.length === 0) {
                    hasMore = false;
                    break;
                }

                allProducts.push(...products);
                pageCount++;

                console.log(`[API MODE] Page ${pageCount}: ${products.length} products (total: ${allProducts.length})`);

                // Check if we got all products
                const resultCount = response.data?.cards?.find(c =>
                    c.card?.card?.['@type'] === 'type.googleapis.com/swiggy.gandalf.widgets.v2.InlineViewFilterSortWidget'
                )?.card?.card?.resultCount;

                if (resultCount && allProducts.length >= resultCount) {
                    hasMore = false;
                    break;
                }

                offset += products.length;

                // Minimal delay between pages
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`[API MODE] Error at offset ${offset}:`, error.message);
                hasMore = false;
            }
        }

        console.log(`[API MODE] ✅ Scraped ${allProducts.length} products from ${categoryName}`);
        return allProducts;

    } catch (error) {
        console.error(`[API MODE] Failed:`, error.message);
        throw error;
    }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    scrapeCategoryProducts: scrapeCategoryProductsAPI,
    extractCategoryNameFromUrl,
    extractCookies: getCookies
};
