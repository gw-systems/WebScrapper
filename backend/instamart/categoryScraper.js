const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const zlib = require('zlib');
const brandManager = require('../utils/brandManager');
const fs = require('fs');
const path = require('path');

/**
 * Fetches all Instamart categories from the sitemap
 * @param {Array<string>} excludedCategories - Categories to exclude
 * @returns {Promise<Array>} Categories with name and URL
 */
async function getAllCategories(excludedCategories = []) {
    const dlog = (m) => {
        try { fs.appendFileSync(path.resolve(__dirname, '../../debug_log.txt'), '[Scraper] ' + m + '\n'); } catch (e) { }
    };

    try {
        console.log('Fetching Instamart categories from sitemap...');
        dlog('Fetching Instamart categories from sitemap...');

        const sitemapUrl = 'https://www.swiggy.com/instamart/sitemap/category-sitemap-0.xml.gz';
        dlog('Requesting URL: ' + sitemapUrl);

        const response = await axios.get(sitemapUrl, {
            responseType: 'arraybuffer', // Important for gzip
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            },
            timeout: 30000
        });
        dlog('Response received, status: ' + response.status);

        // 2. Decompress
        const decompressed = zlib.gunzipSync(response.data).toString();

        // 3. Parse XML
        const parser = new XMLParser();
        const result = parser.parse(decompressed);

        dlog("Sitemap keys: " + JSON.stringify(Object.keys(result)));
        if (result.urlset) {
            dlog("URLSet keys: " + JSON.stringify(Object.keys(result.urlset)));
            const urls = result.urlset.url;
            dlog("URL Entry count: " + (Array.isArray(urls) ? urls.length : 1));
            if (Array.isArray(urls) && urls.length > 0) {
                dlog("First URL entry: " + JSON.stringify(urls[0]));
            }
        } else if (result.sitemapindex) {
            dlog("Found sitemapindex instead of urlset!");
        } else {
            dlog("Unknown structure: " + JSON.stringify(result).substring(0, 200));
        }

        const categories = [];
        const excludedLower = excludedCategories.map(c => c.toLowerCase().trim());

        if (result.urlset && result.urlset.url) {
            const urls = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url];

            for (const entry of urls) {
                const url = entry.loc;
                let name = '';
                try {
                    const urlObj = new URL(url);
                    const params = new URLSearchParams(urlObj.search);
                    if (params.has('categoryName')) {
                        name = params.get('categoryName');
                    } else {
                        // Fallback to path parsing if applicable
                        const parts = url.split('/');
                        name = parts[parts.length - 1];
                    }

                    if (name) {
                        name = decodeURIComponent(name).replace(/-/g, ' ');

                        // Exclusion check
                        const shouldExclude = excludedLower.some(ex => name.toLowerCase().includes(ex));
                        if (!shouldExclude) {
                            categories.push({
                                name: name,
                                url: url,
                                source: 'instamart'
                            });
                        }
                    }
                } catch (e) {
                    console.log(`Failed to parse URL: ${url}`);
                }
            }
        }

        console.log(`Found ${categories.length} Instamart categories.`);
        dlog(`Found ${categories.length} Instamart categories.`);
        return categories;

    } catch (error) {
        if (typeof dlog !== 'undefined') {
            dlog('Error fetching Instamart categories: ' + error.message);
            dlog(error.stack);
        }
        console.error('Error fetching Instamart categories:', error.message);
        return [];
    }
}

/**
 * Scrapes products from a category page
 * @param {Object} page - Puppeteer page
 * @param {string} categoryUrl
 */
async function scrapeCategoryProducts(page, categoryUrl) {
    console.log(`Scraping Instamart category: ${categoryUrl}`);

    // Navigate
    await page.goto(categoryUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for initial render
    await new Promise(r => setTimeout(r, 5000));

    // 1. Extract JSON-LD data (High Quality, Fast)
    const jsonLdProducts = await page.evaluate(() => {
        try {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of scripts) {
                const data = JSON.parse(script.innerText);
                if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
                    return data.itemListElement.map(item => ({
                        name: item.name,
                        image: item.image ? (Array.isArray(item.image) ? item.image[0] : item.image) : '',
                        price: item.offers ? item.offers.price : null,
                        brand: item.brand ? item.brand.name : '',
                        quantity: item.description || '' // Sometimes description has quantity?
                    }));
                }
            }
        } catch (e) {
            console.error("JSON-LD extraction failed", e);
        }
        return [];
    });

    console.log(`Extracted ${jsonLdProducts.length} products from JSON-LD.`);

    // 2. DOM Scraping + Scrolling for Lazy Load
    // We implement a scrolling loop
    let allProducts = [...jsonLdProducts];
    let previousCount = 0;
    let noChangeCount = 0;

    // Heuristic DOM scraper function
    const scrapeDOM = async () => {
        return await page.evaluate(() => {
            const items = [];
            // Find all potential product containers
            // We look for elements that have an image and a price symbol
            const allDivs = document.querySelectorAll('div');

            // Helper to get text content clean
            const getText = (el) => el ? el.innerText.trim() : '';

            // Optimization: Look for 'img' tags and move up to find container
            const imgs = document.querySelectorAll('img');
            const processedContainers = new Set();

            imgs.forEach(img => {
                // Walk up to find a container with Price
                let container = img.parentElement;
                let foundPrice = false;
                let priceVal = '';
                let nameVal = '';

                // Limit depth
                for (let i = 0; i < 8; i++) {
                    if (!container) break;

                    const text = container.innerText || '';
                    if (text.includes('₹')) {
                        // Found a potential container
                        // Try to extract price
                        const priceMatch = text.match(/₹\s*(\d+)/);
                        if (priceMatch) {
                            priceVal = priceMatch[1];
                            foundPrice = true;

                            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
                            if (lines.length > 0) nameVal = lines[0]; // Fallback

                            break;
                        }
                    }
                    container = container.parentElement;
                }

                if (foundPrice && container && !processedContainers.has(container)) {
                    processedContainers.add(container);
                    // Extract Details

                    // Quantity: often "500 g", "1 kg"
                    const quantityMatch = container.innerText.match(/(\d+\s*(?:g|kg|ml|l|pcs|pc))/i);
                    const quantity = quantityMatch ? quantityMatch[1] : '1 unit';

                    items.push({
                        name: nameVal || "Unknown Product",
                        price: priceVal,
                        image: img.src,
                        quantity: quantity,
                        brand: '',
                        source: 'instamart_dom'
                    });
                }
            });

            return items;
        });
    };

    // Scroll Loop
    while (noChangeCount < 3) {
        // Scroll
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await new Promise(r => setTimeout(r, 2000));

        const domProducts = await scrapeDOM();

        // Merge unique products
        const currentCount = allProducts.length;

        domProducts.forEach(dp => {
            // Dedupe by name + price
            const exists = allProducts.some(p => p.name === dp.name && p.price == dp.price);
            if (!exists && dp.name !== "Unknown Product") {
                allProducts.push(dp);
            }
        });

        if (allProducts.length === currentCount) {
            noChangeCount++;
        } else {
            noChangeCount = 0;
            console.log(`Scrolled... Total products: ${allProducts.length}`);
        }

        // Limit total for safety
        if (allProducts.length > 200) break;
    }

    return allProducts.map(p => ({
        ...p,
        id: `instamart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        available: true
    }));
}

module.exports = { getAllCategories, scrapeCategoryProducts };
