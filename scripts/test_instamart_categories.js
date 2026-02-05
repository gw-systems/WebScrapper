const fs = require('fs');
const path = require('path');
const { getAllCategories } = require('../backend/instamart/categoryScraper');

const logFile = path.resolve(__dirname, '../debug_log.txt');
function log(msg) {
    fs.appendFileSync(logFile, msg + '\n');
    console.log(msg);
}

async function test() {
    fs.writeFileSync(logFile, "Starting Test...\n");
    log("Testing Instamart Category Fetching...");
    try {
        const categories = await getAllCategories();
        log(`Successfully fetched ${categories.length} categories.`);

        if (categories.length > 0) {
            log("First 3 categories: " + JSON.stringify(categories.slice(0, 3)));
        } else {
            log("No categories found! Check sitemap URL or parsing logic.");
        }
    } catch (error) {
        log("Test execution failed: " + error.message);
        log(error.stack);
    }
}

test();
