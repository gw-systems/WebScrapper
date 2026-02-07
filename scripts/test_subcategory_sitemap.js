const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const zlib = require('zlib');
const fs = require('fs');

async function testSubcategories() {
    console.log("Fetching subcategory sitemap...");

    const url = 'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap.xml.gz';

    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        },
        timeout: 30000
    });

    const decompressed = zlib.gunzipSync(response.data).toString();
    const parser = new XMLParser();
    const result = parser.parse(decompressed);

    console.log("Sitemap structure keys:", Object.keys(result));

    if (result.urlset && result.urlset.url) {
        const urls = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url];
        console.log(`Found ${urls.length} subcategory URLs`);

        // Look for dairy-related categories
        const dairyUrls = urls.filter(entry => {
            const url = entry.loc.toLowerCase();
            return url.includes('dairy') || url.includes('milk') || url.includes('bread') || url.includes('egg');
        });

        console.log(`\nFound ${dairyUrls.length} dairy-related categories:`);
        dairyUrls.forEach(entry => console.log('  -', entry.loc));

        // Save first 10 for inspection
        console.log('\nFirst 10 subcategories:');
        urls.slice(0, 10).forEach(entry => console.log('  -', entry.loc));
    }
}

testSubcategories().catch(console.error);
