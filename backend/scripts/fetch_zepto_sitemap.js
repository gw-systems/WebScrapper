const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://www.zepto.com/sitemap/categories.xml';
const outputPath = path.join(__dirname, '..', 'zepto', 'categories_sitemap.xml');

console.log('Fetching Zepto categories sitemap...');

https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        fs.writeFileSync(outputPath, data);
        console.log(`✓ Downloaded successfully to: ${outputPath}`);
        console.log(`✓ File size: ${data.length} bytes`);

        // Parse and show basic stats
        const urlMatches = data.match(/<url>/g);
        const locMatches = data.match(/<loc>/g);

        if (urlMatches) {
            console.log(`✓ Number of URLs: ${urlMatches.length}`);
        }
        if (locMatches) {
            console.log(`✓ Number of locations: ${locMatches.length}`);
        }
    });
}).on('error', (err) => {
    console.error('✗ Error downloading sitemap:', err.message);
});
