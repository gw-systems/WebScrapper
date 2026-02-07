const { getAllCategories } = require('../backend/instamart/categoryScraper');

async function testDairy() {
    console.log("Fetching all categories...");
    const categories = await getAllCategories();

    console.log(`Total categories: ${categories.length}`);

    // Search for dairy-related categories
    const dairyKeywords = ['dairy', 'milk', 'bread', 'egg'];
    const dairyCategories = categories.filter(cat => {
        const nameLower = cat.name.toLowerCase();
        return dairyKeywords.some(kw => nameLower.includes(kw));
    });

    console.log(`\nFound ${dairyCategories.length} dairy-related categories:`);
    dairyCategories.forEach(cat => console.log(`  - ${cat.name}`));
}

testDairy().catch(console.error);
