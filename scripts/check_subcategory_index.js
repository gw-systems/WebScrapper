const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const zlib = require('zlib');

async function checkSubcategoryIndex() {
    const url = 'https://www.swiggy.com/instamart/sitemap/subcategory-sitemap.xml.gz';

    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    });

    const decompressed = zlib.gunzipSync(response.data).toString();
    const parser = new XMLParser();
    const result = parser.parse(decompressed);

    console.log("Structure:", JSON.stringify(result, null, 2));

    if (result.sitemapindex && result.sitemapindex.sitemap) {
        const sitemaps = Array.isArray(result.sitemapindex.sitemap)
            ? result.sitemapindex.sitemap
            : [result.sitemapindex.sitemap];

        console.log(`\nFound ${sitemaps.length} child sitemaps:`);
        sitemaps.forEach((sm, idx) => console.log(`${idx + 1}. ${sm.loc}`));
    }
}

checkSubcategoryIndex().catch(console.error);
