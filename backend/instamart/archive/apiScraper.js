const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Instamart API-based scraper (FAST - No Puppeteer!)
 * Uses direct API calls instead of DOM scraping
 * Automatically loads cookies from cookieExtractor.js
 */

// ============================================
// AUTOMATIC COOKIE LOADING
// ============================================

/**
 * Load cookies from cookieExtractor.js output
 * Falls back to manual config if not available
 */
function loadCookieConfig() {
    const cookieFile = path.join(__dirname, 'cookies.json');

    if (fs.existsSync(cookieFile)) {
        try {
            const cookieData = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));

            // Check if expired
            const expiresAt = new Date(cookieData.expiresAt);
            if (new Date() < expiresAt) {
                console.log('[CONFIG] ✅ Loaded cookies from file (auto-extracted)');
                console.log(`[CONFIG] Valid until: ${expiresAt.toLocaleString()}`);
                return {
                    COOKIE: cookieData.cookieString,
                    STORE_ID: cookieData.storeId,
                    PRIMARY_STORE_ID: cookieData.primaryStoreId,
                    SECONDARY_STORE_ID: cookieData.secondaryStoreId,
                    USER_AGENT: cookieData.userAgent
                };
            } else {
                console.log('[CONFIG] ⚠️  Cookies expired! Run: node backend/instamart/cookieExtractor.js');
            }
        } catch (error) {
            console.log('[CONFIG] ⚠️  Could not load cookies.json:', error.message);
        }
    } else {
        console.log('[CONFIG] ⚠️  No cookies.json found!');
        console.log('[CONFIG] Run: node backend/instamart/cookieExtractor.js');
    }

    // Fallback to manual config
    console.log('[CONFIG] Using fallback manual configuration...');
    return MANUAL_CONFIG;
}

// ============================================
// MANUAL CONFIGURATION (Fallback)
// ============================================

const MANUAL_CONFIG = {
    // Copy this entire cookie string from DevTools → Network → category-listing/v2 → Cookie header
    COOKIE: 'deviceId=s%3Afeb4ad36-f36b-464e-9ccc-524a2ca3e0ee.FJ0SMR0UWzbbjI9MCWXifnEfqe7C%2FPEhZvMvqBwgncU; tid=s%3A2e7b7973-6e5f-4fd7-9d2a-0eeaba1d5c1f.VmEck2cMNlBCg1HkaU9SXYhanI%2BpqgSv1013azVOWMk; sid=s%3Apjob6f6b-e9eb-4161-99d0-a740c92007fe.sSu2r7KvdOcflR7xQ7YGj7BXjKNVGYVe5LDsoR1HpK8; lat=s%3A18.9690247.kEUzj0AVvWevFJbyZs1Zl2ri9vlpqA0dsnX8wJnWjVY; lng=s%3A72.8205292.FJoY%2BM0uCPUiJcqQv%2BZKQnj7tTdXeZ3B7h9EMRx%2FRC4; address=s%3AMumbai%20Central%2C%20Mumbai%2C%20Maharashtra%2C%20India.5aM3sL01qiU1hPKBaLGOEU%2FqVKC7PGorOKXVq3tmOXo',

    // Store IDs - extract from URL when visiting Instamart category page
    STORE_ID: '1135722',
    PRIMARY_STORE_ID: '1135722',
    SECONDARY_STORE_ID: '1396282',

    // User-Agent from your browser
    USER_AGENT: 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36',
};

// Load configuration (automatic or manual)
const CONFIG = loadCookieConfig();

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Fetch products for a category using direct API call
 * @param {string} categoryName - e.g., "Fresh Fruits"
 * @param {number} offset - Pagination offset (0, 20, 40...)
 * @returns {Promise<Object>} API response data
 */
async function fetchCategoryProducts(categoryName, offset = 0) {
    const url = 'https://www.swiggy.com/api/instamart/category-listing/v2';

    const params = {
        categoryName: categoryName,
        taxonomyType: 'Speciality taxonomy 1',
        offset: offset,
        storeId: CONFIG.STORE_ID,
        primaryStoreId: CONFIG.PRIMARY_STORE_ID,
        secondaryStoreId: CONFIG.SECONDARY_STORE_ID
    };

    const headers = {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Content-Type': 'application/json',
        'Cookie': CONFIG.COOKIE,
        'Referer': `https://www.swiggy.com/instamart/category-listing?categoryName=${encodeURIComponent(categoryName).replace(/%20/g, '+')}&storeId=${CONFIG.STORE_ID}&offset=0&taxonomyType=Speciality+taxonomy+1`,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
    };

    try {
        console.log(`[API] Fetching ${categoryName}, offset=${offset}...`);
        const response = await axios.get(url, { params, headers, timeout: 30000 });
        return response.data;
    } catch (error) {
        console.error(`[API ERROR] ${error.message}`);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, error.response.data);
        }
        throw error;
    }
}

/**
 * Extract product information from API response
 * @param {Object} apiResponse - Raw API response
 * @returns {Array} Array of product objects
 */
function extractProducts(apiResponse) {
    if (!apiResponse || !apiResponse.data || !apiResponse.data.cards) {
        console.log('[PARSE] No cards found in response');
        return [];
    }

    const cards = apiResponse.data.cards;

    // Find the card with gridElements (contains products)
    const productCard = cards.find(card =>
        card.card?.card?.gridElements?.infoWithStyle?.items
    );

    if (!productCard) {
        console.log('[PARSE] No product card found');
        return [];
    }

    const items = productCard.card.card.gridElements.infoWithStyle.items;
    console.log(`[PARSE] Found ${items.length} products`);

    const products = [];

    items.forEach(item => {
        try {
            // Get the listing variant (main variation to display)
            const listingVariation = item.variations?.find(v => v.listingVariant) || item.variations?.[0];

            if (!listingVariation) {
                console.warn(`[PARSE] No variation found for ${item.displayName}`);
                return;
            }

            const product = {
                // Basic Info
                name: item.displayName || 'Unknown',
                brand: item.brand || 'Unknown',
                skuId: listingVariation.skuId || '',
                productId: item.productId || '',

                // Pricing
                price: listingVariation.price?.offerPrice?.units || '0',
                mrp: listingVariation.price?.mrp?.units || '0',
                discount: listingVariation.price?.offerApplied?.listingDescription || '',
                unitPrice: listingVariation.price?.unitLevelPrice || '',

                // Product Details
                quantity: listingVariation.quantityDescription || '',
                weight: listingVariation.weightInGrams || 0,
                category: listingVariation.category || '',
                subCategory: listingVariation.subCategoryType || '',
                superCategory: listingVariation.superCategory || '',

                // Images (construct full URL)
                image: listingVariation.imageIds?.[0]
                    ? `https://media-assets.swiggy.com/swiggy/image/upload/${listingVariation.imageIds[0]}`
                    : '',
                allImages: (listingVariation.imageIds || []).map(id =>
                    `https://media-assets.swiggy.com/swiggy/image/upload/${id}`
                ),

                // Rating & Reviews
                rating: listingVariation.rating?.value || '0',
                ratingCount: listingVariation.rating?.count || '0',

                // Availability
                inStock: item.inStock || false,
                isAvailable: item.isAvail || false,

                // Additional Info
                description: listingVariation.shortDescription || '',
                badges: item.badges?.map(b => b.text).join(', ') || '',
                isAd: item.badges?.some(b => b.type === 'BADGE_TYPE_AD') || false,
                isGourmet: item.badges?.some(b => b.type === 'BADGE_TYPE_GOURMET') || false,
            };

            products.push(product);
        } catch (error) {
            console.error(`[PARSE ERROR] Failed to parse product: ${error.message}`);
        }
    });

    return products;
}

/**
 * Scrape all products from a category with pagination
 * @param {string} categoryName - Category to scrape
 * @param {number} maxPages - Maximum pages to scrape (0 = all)
 * @returns {Promise<Array>} All products from category
 */
async function scrapeCategory(categoryName, maxPages = 0) {
    console.log(`\n========================================`);
    console.log(`Starting scrape: ${categoryName}`);
    console.log(`========================================\n`);

    const allProducts = [];
    let offset = 0;
    let pageCount = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            // Fetch page
            const response = await fetchCategoryProducts(categoryName, offset);
            const products = extractProducts(response);

            if (products.length === 0) {
                console.log(`[PAGINATION] No more products found at offset ${offset}`);
                hasMore = false;
                break;
            }

            allProducts.push(...products);
            pageCount++;

            console.log(`[PAGINATION] Page ${pageCount}: Got ${products.length} products (total: ${allProducts.length})`);

            // Check if we should continue
            if (maxPages > 0 && pageCount >= maxPages) {
                console.log(`[PAGINATION] Reached max pages (${maxPages})`);
                hasMore = false;
                break;
            }

            // Check result count from API
            const resultCount = response.data?.cards?.find(c =>
                c.card?.card?.['@type'] === 'type.googleapis.com/swiggy.gandalf.widgets.v2.InlineViewFilterSortWidget'
            )?.card?.card?.resultCount;

            if (resultCount && allProducts.length >= resultCount) {
                console.log(`[PAGINATION] Got all ${resultCount} products`);
                hasMore = false;
                break;
            }

            // Increment offset (typical page size is 20-50)
            offset += products.length;

            // Rate limiting - be nice to the API
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`[ERROR] Failed at offset ${offset}: ${error.message}`);
            hasMore = false;
        }
    }

    console.log(`\n========================================`);
    console.log(`Scrape complete: ${allProducts.length} products`);
    console.log(`========================================\n`);

    return allProducts;
}

/**
 * Save products to JSON file
 */
function saveProducts(products, categoryName) {
    const fileName = `instamart_${categoryName.replace(/[^a-zA-Z0-9]/g, '_')}_api.json`;
    const filePath = path.join(__dirname, '../../scraped_data', fileName);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
    console.log(`✅ Saved ${products.length} products to: ${filePath}`);

    return filePath;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    try {
        // Example: Scrape "Fresh Fruits" category
        const categoryName = 'Fresh Fruits';
        const products = await scrapeCategory(categoryName, 0); // 0 = all pages

        // Save results
        const filePath = saveProducts(products, categoryName);

        console.log('\n✅ API scraping completed successfully!');
        console.log(`📁 Output: ${filePath}`);
        console.log(`📊 Total products: ${products.length}`);

    } catch (error) {
        console.error('\n❌ Scraping failed:', error.message);
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
    fetchCategoryProducts,
    extractProducts,
    scrapeCategory,
    saveProducts,
    CONFIG
};
