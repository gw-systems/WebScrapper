#!/usr/bin/env node

/**
 * Instamart Scraper - Automated Workflow
 * 
 * This script automatically:
 * 1. Extracts fresh cookies (if needed)
 * 2. Scrapes products using fast API calls
 * 
 * No manual cookie extraction required!
 */

const { getCookies } = require('./cookieExtractor');
const { scrapeCategory, saveProducts } = require('./apiScraper');

async function main() {
    const args = process.argv.slice(2);

    // Parse arguments
    const forceRefresh = args.includes('--refresh');
    const categoryArg = args.find(arg => arg.startsWith('--category='));
    const category = categoryArg ? categoryArg.split('=')[1] : 'Fresh Fruits';
    const maxPagesArg = args.find(arg => arg.startsWith('--pages='));
    const maxPages = maxPagesArg ? parseInt(maxPagesArg.split('=')[1]) : 0;

    console.log('╔════════════════════════════════════════════╗');
    console.log('║   Instamart Automated Scraper (Hybrid)    ║');
    console.log('╚════════════════════════════════════════════╝\n');

    try {
        // Step 1: Get fresh cookies (auto-extracted if needed)
        console.log('📍 Step 1: Cookie Management\n');
        await getCookies(forceRefresh);

        console.log('\n📊 Step 2: Scraping Products\n');

        // Step 2: Scrape using API
        const products = await scrapeCategory(category, maxPages);

        // Step 3: Save results
        const filePath = saveProducts(products, category);

        // Success summary
        console.log('\n╔════════════════════════════════════════════╗');
        console.log('║            ✅ SUCCESS!                     ║');
        console.log('╚════════════════════════════════════════════╝');
        console.log(`📁 File: ${filePath}`);
        console.log(`📦 Products: ${products.length}`);
        console.log(`🏷️  Category: ${category}`);
        console.log('\n💡 Tip: Run with --refresh to force cookie refresh');

    } catch (error) {
        console.error('\n╔════════════════════════════════════════════╗');
        console.error('║            ❌ ERROR                        ║');
        console.error('╚════════════════════════════════════════════╝');
        console.error(error.message);
        console.error('\n💡 Try running with --refresh to get fresh cookies');
        process.exit(1);
    }
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Instamart Automated Scraper - No Manual Cookies Needed!

Usage:
  node backend/instamart/scrape.js [options]

Options:
  --category=NAME    Category to scrape (default: "Fresh Fruits")
  --pages=N          Max pages to scrape (default: all)
  --refresh          Force refresh cookies before scraping
  --help, -h         Show this help

Examples:
  # Scrape Fresh Fruits (auto-cookies)
  node backend/instamart/scrape.js

  # Scrape Bread and Buns with fresh cookies
  node backend/instamart/scrape.js --category="Bread and Buns" --refresh

  # Scrape only 3 pages
  node backend/instamart/scrape.js --category="Snacks" --pages=3

How it works:
  1. Checks for valid cookies (cookies.json)
  2. If missing/expired, launches browser to extract fresh ones
  3. Uses fast API calls to scrape products
  4. Saves to scraped_data/

No more manual DevTools cookie copying! 🎉
`);
    process.exit(0);
}

main();
