const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const zlib = require('zlib');

async function debugSitemap() {
    console.log("Fetching sitemaps...");

    const sitemapUrls = [
        'https://www.swiggy.com/instamart/sitemap/category-sitemap-0.xml.gz'
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
                    let url = e.loc;
                    console.log(`ORIG: ${url}`);

                    // 1. Remove city
                    url = url.replace(/\/city\/[^/]+/, '');

                    // 2. Remove filter suffix (e.g. /chips-and-crisps-6822...)
                    // Look for path part ending in dash + 24 hex chars
                    const parts = url.split('/');
                    const lastPart = parts[parts.length - 1];
                    if (lastPart && /-[a-f0-9]{24}$/.test(lastPart)) {
                        console.log(`   -> Detected Filter ID in ${lastPart}`);
                        parts.pop(); // Remove it
                        url = parts.join('/');
                    }

                    console.log(`NEW : ${url}\n`);
                });
            }
        } catch (e) {
            console.error(`Error fetching ${url}:`, e.message);
        }
    }
}

debugSitemap();
