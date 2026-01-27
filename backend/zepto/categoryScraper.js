const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

/**
 * Fetches all Zepto categories from their sitemap
 * @returns {Promise<Array>} Array of category objects with name and URL
 */
async function getAllCategories() {
    try {
        console.log('Fetching Zepto categories from sitemap...');

        // Fetch the categories sitemap
        const response = await axios.get('https://www.zepto.com/sitemap/categories.xml');

        // Parse XML
        const parser = new XMLParser();
        const result = parser.parse(response.data);

        const categories = [];

        // Extract URLs from the sitemap
        if (result.urlset && result.urlset.url) {
            const urls = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url];

            for (const urlEntry of urls) {
                const url = urlEntry.loc;

                // Extract category name from URL
                // URL format: https://www.zepto.com/cn/category-name/subcategory-name/cid/xxx/scid/xxx
                const match = url.match(/\/cn\/([^/]+)\/([^/]+)\//);

                if (match) {
                    const mainCategory = match[1].replace(/-/g, ' ');
                    const subCategory = match[2].replace(/-/g, ' ');

                    categories.push({
                        name: `${mainCategory} > ${subCategory}`,
                        mainCategory,
                        subCategory,
                        url
                    });
                }
            }
        }

        console.log(`Found ${categories.length} categories`);
        return categories;

    } catch (error) {
        console.error('Error fetching Zepto categories:', error.message);
        return [];
    }
}

/**
 * Scrapes products from a specific category URL
 * @param {Object} page - Puppeteer page object
 * @param {string} categoryUrl - The category URL to scrape
 * @returns {Promise<Array>} Array of products
 */
async function scrapeCategoryProducts(page, categoryUrl) {
    try {
        console.log(`Scraping category: ${categoryUrl}`);

        // Navigate to category page
        await page.goto(categoryUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for initial load
        await new Promise(r => setTimeout(r, 3000));

        // Scroll to load all products (lazy loading)
        console.log('Scrolling to load all products...');
        let previousHeight = 0;
        let scrollAttempts = 0;
        const maxScrollAttempts = 10;

        while (scrollAttempts < maxScrollAttempts) {
            // Scroll to bottom
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });

            // Wait for new content to load
            await new Promise(r => setTimeout(r, 2000));

            // Check if we've reached the bottom
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);

            if (currentHeight === previousHeight) {
                console.log('Reached bottom of page');
                break;
            }

            previousHeight = currentHeight;
            scrollAttempts++;
            console.log(`Scroll attempt ${scrollAttempts}/${maxScrollAttempts}`);
        }

        // Scroll back to top to ensure all elements are in view
        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise(r => setTimeout(r, 1000));

        // Extract products using data-slot-id selectors
        const products = await page.evaluate(() => {
            const results = [];

            // Find all product containers - look for elements with ProductName slot
            const productElements = document.querySelectorAll('[data-slot-id="ProductName"]');

            productElements.forEach(nameEl => {
                try {
                    // Navigate up to find the product container
                    // The container should have all the product data slots
                    // Try to find a common parent that contains all slots
                    let container = nameEl;

                    // Go up the DOM tree to find a container that has all the data
                    for (let i = 0; i < 10; i++) {
                        container = container.parentElement;
                        if (!container) break;

                        // Check if this container has the price and other elements
                        const hasPrice = container.querySelector('[data-slot-id="EdlpPrice"]');
                        const hasImage = container.querySelector('img');

                        if (hasPrice && hasImage) {
                            break; // Found the right container
                        }
                    }

                    if (!container) return;

                    // Extract product information from this specific container
                    const name = nameEl.querySelector('span')?.innerText || nameEl.innerText || 'Unknown Product';

                    // Find price (EdlpPrice slot) within this container
                    const priceEl = container.querySelector('[data-slot-id="EdlpPrice"]');
                    const price = priceEl ? (priceEl.innerText || priceEl.textContent || 'Price unavailable') : 'Price unavailable';

                    // Find pack size/quantity within this container
                    const packSizeEl = container.querySelector('[data-slot-id="PackSize"]');
                    const quantity = packSizeEl ? (packSizeEl.innerText || packSizeEl.textContent || '1 item') : '1 item';

                    // Find image within this container
                    const imgEl = container.querySelector('img');
                    const imageUrl = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';

                    // Find rating if available within this container
                    const ratingEl = container.querySelector('[data-slot-id="RatingInformation"]');
                    const rating = ratingEl ? ratingEl.innerText : null;

                    results.push({
                        id: `zepto_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
                        name: name.trim(),
                        price: price.trim(),
                        quantity: quantity.trim(),
                        imageUrl,
                        rating,
                        available: true,
                        source: 'zepto'
                    });
                } catch (err) {
                    console.error('Error extracting product:', err);
                }
            });

            return results;
        });

        console.log(`Found ${products.length} products in category`);
        return products;

    } catch (error) {
        console.error(`Error scraping category ${categoryUrl}:`, error.message);
        return [];
    }
}

module.exports = {
    getAllCategories,
    scrapeCategoryProducts
};
