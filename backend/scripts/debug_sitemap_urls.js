const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const zlib = require('zlib');

async function debugSitemap() {
    console.log("Fetching sitemaps...");

    // Using the list from categoryScraper.js
    const sitemapUrls = [
        'https://www.swiggy.com/instamart/sitemap/category-sitemap-0.xml.gz',
        'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap-0.xml.gz'
    ];

    for (const url of sitemapUrls) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                }
            });
            const decompressed = zlib.gunzipSync(response.data).toString();
            const parser = new XMLParser();
            const result = parser.parse(decompressed);

            if (result.urlset && result.urlset.url) {
                const entries = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url];
                console.log(`Found ${entries.length} entries.`);

                const chipsEntries = entries.filter(e => e.loc && e.loc.toLowerCase().includes('chips'));

                chipsEntries.forEach(e => {
                    console.log(`MATCH: ${e.loc}`);
                });
            }
        } catch (e) {
            console.error(`Error fetching ${url}:`, e.message);
        }
    }
}

debugSitemap();
