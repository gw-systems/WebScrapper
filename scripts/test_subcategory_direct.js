const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const zlib = require('zlib');

async function testSubcategorySitemap() {
    const url = 'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap.xml.gz';

    console.log(`Fetching: ${url}`);
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    });

    console.log(`Response status: ${response.status}`);

    const decompressed = zlib.gunzipSync(response.data).toString();
    console.log("Decompressed length:", decompressed.length);
    console.log("First 500 chars:", decompressed.substring(0, 500));

    const parser = new XMLParser();
    const result = parser.parse(decompressed);

    console.log("\nParsed result keys:", Object.keys(result));
    console.log("\nFull parsed result:", JSON.stringify(result, null, 2));
}

testSubcategorySitemap().catch(err => {
    console.error("Error:", err.message);
    console.error(err.stack);
});
