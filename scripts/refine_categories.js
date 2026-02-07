const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../scraped_data/instamart_categories.json');
const outputFile = path.join(__dirname, '../scraped_data/unique_categories.json');

try {
    const rawData = fs.readFileSync(inputFile, 'utf8');
    const categories = JSON.parse(rawData);

    // Map to store unique categories by slug
    // Link format: /instamart/city/<city>/c/<slug>
    const uniqueMap = new Map();

    categories.forEach(item => {
        const parts = item.link.split('/c/');
        if (parts.length === 2) {
            const slug = parts[1];
            // Clean text: "Office and Electricals in Bangalore" -> "Office and Electricals"
            const name = item.text.replace(/ in [a-zA-Z]+$/, '');

            if (!uniqueMap.has(slug)) {
                uniqueMap.set(slug, {
                    name: name,
                    slug: slug,
                    exampleLink: item.link
                });
            }
        }
    });

    const uniqueList = Array.from(uniqueMap.values());

    // Generate output
    fs.writeFileSync(outputFile, JSON.stringify(uniqueList, null, 2));

    console.log(`✅ Processed ${categories.length} raw entries.`);
    console.log(`✅ Extracted ${uniqueList.length} unique categories.`);
    console.log(`💾 Saved to ${outputFile}`);

} catch (e) {
    console.error("Error processing file:", e);
}
