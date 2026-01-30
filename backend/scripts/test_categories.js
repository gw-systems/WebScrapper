const { getAllCategories } = require('./zepto/categoryScraper');

async function testCategoryDiscovery() {
    console.log('Testing Zepto category discovery...\n');

    const categories = await getAllCategories();

    console.log(`\nTotal categories found: ${categories.length}\n`);

    // Show first 10 categories as examples
    console.log('Sample categories:');
    categories.slice(0, 10).forEach((cat, index) => {
        console.log(`${index + 1}. ${cat.name}`);
        console.log(`   URL: ${cat.url}\n`);
    });

    // Group by main category
    const grouped = {};
    categories.forEach(cat => {
        if (!grouped[cat.mainCategory]) {
            grouped[cat.mainCategory] = [];
        }
        grouped[cat.mainCategory].push(cat.subCategory);
    });

    console.log('\nCategories by main category:');
    Object.keys(grouped).slice(0, 5).forEach(main => {
        console.log(`\n${main} (${grouped[main].length} subcategories):`);
        console.log(`  - ${grouped[main].slice(0, 3).join(', ')}...`);
    });
}

testCategoryDiscovery();
