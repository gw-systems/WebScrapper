const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../scraped_data/instamart_full_categories.json');
const LOG_FILE = path.join(__dirname, 'debug_sitemap_fetch.log');

if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);

function log(msg) {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

// List of all known sitemaps
const SITEMAP_URLS = [

    'https://www.swiggy.com/instamart/sitemap/category-sitemap-0.xml.gz',
    'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap-0.xml.gz',
    'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap-1.xml.gz',
    'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap-2.xml.gz',
    'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap-3.xml.gz',
    'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap-4.xml.gz',
    'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap-5.xml.gz',
    'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap-6.xml.gz',
    'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap-7.xml.gz',
    'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap-8.xml.gz',
    'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap-9.xml.gz'
];

async function fetchAndParseSitemap(url) {
    try {
        log(`Fetching ${url}...`);
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br'
            },
            timeout: 30000
        });

        log(` -> Status: ${response.status}`);
        log(` -> Header content-type: ${response.headers['content-type']}`);
        log(` -> Data length: ${response.data.length}`);

        let decompressed;
        try {
            decompressed = zlib.gunzipSync(response.data).toString();
        } catch (zlibErr) {
            log(` -> Zlib Error: ${zlibErr.message}. Trying raw string...`);
            decompressed = response.data.toString();
        }

        log(` -> Decompressed length: ${decompressed.length}`);
        log(` -> Preview: ${decompressed.substring(0, 200)}...`);

        const parser = new XMLParser();
        const result = parser.parse(decompressed);

        log(` -> Keys: ${Object.keys(result).join(', ')}`);

        if (result.urlset && result.urlset.url) {
            const urls = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url];
            log(` -> Found ${urls.length} URLs`);
            return urls.map(u => u.loc).filter(l => l && l.includes('/instamart/'));
        } else if (result.sitemapindex && result.sitemapindex.sitemap) {
            log(" -> Found sitemap index, not urlset. This might be the wrong file type.");
        }

        return [];
    } catch (e) {
        log(` -> Failed/Skipped: ${e.message}`);
        if (e.response) log(` -> Response Status: ${e.response.status}`);
        return [];
    }
}

function parseInstamartUrl(url) {
    // Expected formats:
    // 1. /instamart/category-listing?categoryName=Dairy%2C+Bread+and+Eggs... (unlikely in sitemap, sitemaps use SEO URLs)
    // 2. /instamart/city/bangalore/c/dairy-bread-and-eggs
    // 3. /instamart/city/bangalore/c/dairy-bread-and-eggs/milk-and-milk-products
    // 4. /instamart/city/bangalore/c/dairy-bread-and-eggs/milk-and-milk-products/milk-6822...

    // Step 1: Remove generic prefixes and City names to get "slug" path
    // Remove "https://www.swiggy.com"
    let path = url.replace('https://www.swiggy.com', '');

    // Remove "/city/xyz" -> becomes /instamart/c/...
    path = path.replace(/\/city\/[^/]+/, '');

    // Check if it's a category link (c) or subcategory link (sc)
    const isCategory = path.includes('/c/');
    const isSubCategory = path.includes('/sc/');

    if (!isCategory && !isSubCategory) return null;

    // Determine the segment pattern
    let cleanPath;
    if (isCategory) {
        cleanPath = path.substring(path.indexOf('/c/') + 3);
    } else {
        cleanPath = path.substring(path.indexOf('/sc/') + 4);
    }

    const parts = cleanPath.split('/').filter(p => p);

    if (parts.length === 0) return null;

    const categorySlug = parts[0];
    const categoryName = slugToName(categorySlug);

    let subCategorySlug = null;
    let subCategoryName = null;
    let filterId = null;

    if (parts.length > 1) {
        let scPart = parts[1];

        // Sometimes the second part is the filter ID itself if no subcategory?
        // But usually structure is Category > Subcategory > Filter

        // Check if last part is a filter ID (ends with -[24 hex chars])
        const filterMatch = scPart.match(/-([a-z0-9]{24})$/);

        // If it looks like a filter ID, we treat the prefix as the name
        if (filterMatch) {
            filterId = filterMatch[1];
            // Remove the ID suffix to get name
            scPart = scPart.replace(/-[a-z0-9]{24}$/, '');
        }

        subCategorySlug = scPart;
        subCategoryName = slugToName(scPart);
    }

    // If there is a 3rd part, that is definitely the filter/item
    if (parts.length > 2) {
        const fPart = parts[2];
        const filterMatch = fPart.match(/-([a-z0-9]{24})$/);
        if (filterMatch) {
            filterId = filterMatch[1];
        } else {
            // Maybe deeper nesting? Let's ignore deeper than 2 levels for now to keep it sane
        }
    }

    return {
        name: subCategoryName ? `${categoryName} > ${subCategoryName}` : categoryName,
        category: categoryName,
        subCategory: subCategoryName || '', // Empty if top level
        url: url, // Keep original example URL
        slug: categorySlug,
        filterId: filterId
    };
}

function slugToName(slug) {
    if (!slug) return '';
    // "dairy-bread-and-eggs" -> "Dairy Bread And Eggs"
    // Also handle Swiggy's specific encoding if any
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function main() {
    log("🚀 Starting Instamart Sitemap Fetcher...");

    let allUrls = [];
    for (const sitemap of SITEMAP_URLS) {
        const urls = await fetchAndParseSitemap(sitemap);
        allUrls = allUrls.concat(urls);
    }

    log(`\nProcessing ${allUrls.length} collected URLs...`);

    const uniqueMap = new Map();

    for (const url of allUrls) {
        const parsed = parseInstamartUrl(url);
        if (parsed) {
            // Deduplicate by Name
            if (!uniqueMap.has(parsed.name)) {
                // Prefer URLs with filterId if available (more specific/direct) 
                // OR prefer shorter URLs for top level?
                // Actually, we want generic URLs.
                // We store the generic "slug pair" as the key to avoid city duplicates
                const key = parsed.subCategory ? `${parsed.categoryBase}|${parsed.subCategory}` : parsed.categoryBase;

                uniqueMap.set(parsed.name, parsed);
            }
        }
    }

    const categories = Array.from(uniqueMap.values());

    // Sort logic: Top level first, then subcategories
    categories.sort((a, b) => a.name.localeCompare(b.name));

    // Save
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(categories, null, 2));

    log(`\n✅ Successfully generated full category list.`);
    log(`📦 Total Unique Categories/Subcategories: ${categories.length}`);
    log(`💾 Saved to: ${OUTPUT_FILE}`);
}

main();
