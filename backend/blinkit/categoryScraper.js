const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const path = require('path');
const fs = require('fs');

/**
 * Extracts product information from Blinkit JSON response (snippets format)
 * Reused from searchHelpers.js (mirrored for convenience or could be imported)
 */
function extractProductInformation(jsonResponse) {
    if (!jsonResponse || !jsonResponse.response || !Array.isArray(jsonResponse.response.snippets)) {
        return [];
    }

    const prods = [];
    const snippets = jsonResponse.response.snippets;

    snippets.forEach((snippet, idx) => {
        // Only process snippets that are actually products
        if (!snippet.data || !snippet.data.name || !snippet.data.identity) {
            return;
        }

        // Skip non-product snippets like headers, pill containers, etc.
        if (snippet.widget_type === "pill_container_snippet" ||
            snippet.widget_type === "image_text_vr_type_header") {
            return;
        }

        try {
            const raw = snippet.data;
            const id = (raw.identity && raw.identity.id) ? raw.identity.id : `blinkit_${Date.now()}_${idx}`;
            const name = (raw.name && typeof raw.name === 'object' && raw.name.text) ? raw.name.text :
                (typeof raw.name === 'string' ? raw.name : 'Unknown Product');

            let price = 'Price unavailable';
            if (raw.normal_price && raw.normal_price.text) {
                price = raw.normal_price.text;
            } else if (raw.price && typeof raw.price === 'number') {
                price = `₹${raw.price.toFixed(2)}`;
            }

            let origPrice = null;
            if (raw.mrp && raw.mrp.text) {
                origPrice = raw.mrp.text;
            }

            const qty = raw.variant && raw.variant.text ? raw.variant.text : 'N/A';
            const imgUrl = raw.image && raw.image.url ? raw.image.url : '';

            const avail = raw.hasOwnProperty('is_sold_out') ? !raw.is_sold_out :
                (raw.hasOwnProperty('inventory') ? raw.inventory > 0 : true);

            prods.push({
                id: `blinkit_${id}`,
                name: String(name).trim(),
                brand: 'Blinkit', // Blinkit doesn't always have a separate brand field in snippets
                price: String(price).trim(),
                quantity: String(qty).trim(),
                imageUrl: imgUrl,
                rating: null, // Rating not easily available in these snippets
                available: avail,
                source: 'blinkit'
            });

        } catch (err) {
            console.error(`Error processing Blinkit product: ${err.message}`);
        }
    });

    return prods;
}

// Mapping of Blinkit parent category IDs to human-readable names
const PARENT_CATEGORY_MAP = {
    '4': 'Meat & Fish',
    '5': 'Pet Care',
    '7': 'Baby Care',
    '9': 'Sweet Tooth',
    '12': 'Tea, Coffee & Milk Drinks',
    '13': 'Beauty & Cosmetics',
    '14': 'Dairy & Breakfast',
    '15': 'Instant & Frozen Food',
    '16': 'Atta, Rice & Dal',
    '17': 'Cleaning Essentials',
    '18': 'Personal Care',
    '332': 'Cold Drinks & Juices',
    '480': 'Home & Office',
    '542': 'Pharma & Wellness',
    '1011': 'Kitchen & Appliances',
    '1237': 'Munchies',
    '1487': 'Home Needs',
    '1557': 'Spices',
    '1559': 'Books',
    '2367': 'Beverages',
    '972': 'Dips & Spreads'
};

/**
 * Fetches all Blinkit categories from sitemap
 * @param {Array<string>} excludedCategories - Array of terms to exclude
 * @returns {Promise<Array>} Array of category objects
 */
async function getAllCategories(excludedCategories = []) {
    try {
        console.log('Fetching Blinkit categories...');

        let xmlData = '';
        const localSitemapPath = path.join(__dirname, 'categories.xml');

        // Try to read local file first (captured via curl)
        if (fs.existsSync(localSitemapPath)) {
            console.log('Reading categories from local file...');
            xmlData = fs.readFileSync(localSitemapPath, 'utf8');
        } else {
            console.log('Fetching categories from online sitemap...');
            // Fallback to online with headers
            const response = await axios.get('https://blinkit.com/categories.xml', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 15000
            });
            xmlData = response.data;
        }

        const parser = new XMLParser();
        const result = parser.parse(xmlData);

        const categories = [];
        const excludedLower = excludedCategories.map(cat => cat.toLowerCase().trim());

        if (result.urlset && result.urlset.url) {
            const urls = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url];

            for (const urlEntry of urls) {
                const url = urlEntry.loc;
                if (!url || !url.includes('/cn/')) continue;

                // Pattern: https://blinkit.com/cn/[slug]/cid/[pId]/[cId]
                const match = url.match(/\/cn\/([^/]+)\/cid\/([^/]+)\/([^/]+)/);
                if (match) {
                    const slug = match[1];
                    const pId = match[2];
                    const cId = match[3];

                    const name = slug.replace(/-/g, ' ');
                    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
                    const mainCategoryName = PARENT_CATEGORY_MAP[pId] || `Cat-${pId}`;

                    // Check if should exclude
                    const shouldExclude = excludedLower.some(excluded =>
                        formattedName.toLowerCase().includes(excluded) ||
                        mainCategoryName.toLowerCase().includes(excluded)
                    );

                    if (!shouldExclude) {
                        categories.push({
                            name: `${mainCategoryName} > ${formattedName}`,
                            mainCategory: mainCategoryName,
                            subCategory: formattedName,
                            url: url.trim()
                        });
                    }
                }
            }
        }

        console.log(`Found ${categories.length} Blinkit categories`);
        return categories;

    } catch (error) {
        console.error('Error fetching Blinkit categories:', error.message);
        return [];
    }
}

/**
 * Scrapes products from a specific category URL
 * Uses network interception to capture JSON data
 */
async function scrapeCategoryProducts(page, categoryUrl) {
    console.log(`Scraping Blinkit category: ${categoryUrl}`);

    let responseHandler = null;

    try {
        let productJsonResponse = null;

        const productJsonPromise = new Promise((resolve) => {
            responseHandler = async (response) => {
                const url = response.url();
                const type = response.request().resourceType();

                if (type === "xhr" || type === "fetch") {
                    try {
                        const json = await response.json().catch(() => null);
                        if (json && json.response && Array.isArray(json.response.snippets)) {
                            // Verify it has products
                            const hasProducts = json.response.snippets.some(s =>
                                s.data && s.data.name && s.widget_type !== "pill_container_snippet"
                            );
                            if (hasProducts) {
                                resolve(json);
                            }
                        }
                    } catch (e) { }
                }
            };

            page.on('response', responseHandler);

            // Timeout after 30 seconds
            setTimeout(() => resolve(null), 30000);
        });

        // Navigate to category page
        await page.goto(categoryUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait for JSON or timeout
        const json = await productJsonPromise;

        // Clean up
        if (responseHandler) {
            page.off('response', responseHandler);
        }

        if (!json) {
            console.log('Timed out waiting for product JSON');
            return [];
        }

        const products = extractProductInformation(json);
        console.log(`Extracted ${products.length} products from category JSON`);
        return products;

    } catch (error) {
        console.error(`Error scraping category ${categoryUrl}:`, error.message);
        if (responseHandler) page.off('response', responseHandler);
        return [];
    }
}

module.exports = {
    getAllCategories,
    scrapeCategoryProducts
};
