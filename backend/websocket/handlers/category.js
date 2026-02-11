const BrowserPool = require('../../services/BrowserPool');
const logger = require('../../utils/logger');
const config = require('../../config/environment');
const { withTimeout, isTimeoutError } = require('../../utils/timeout');
const MetricsService = require('../../services/MetricsService');
const zeptoScraper = require('../../zepto/categoryScraper');
// Instamart moved to standalone scraper
let blinkitScraper;
try { blinkitScraper = require('../../blinkit/categoryScraper'); } catch (e) { }

const scrapers = {
    zepto: zeptoScraper,
    blinkit: blinkitScraper
};

const CategoryExcelWriter = require('../../excelWriter');
const fs = require('fs');
const path = require('path');

async function handleScrapeCategories(socket, cid, data) {
    console.log(`[DEBUG] handleScrapeCategories triggered for cid=${cid}`);
    const { service, excludedCategories } = data;
    console.log(`[DEBUG] Service: ${service}, Excluded: ${JSON.stringify(excludedCategories)}`);

    const scraper = scrapers[service];
    if (!scraper) {
        console.log(`[DEBUG] Invalid or unsupported service: ${service}`);
        socket.send(JSON.stringify({ status: 'error', message: `Category scraping not supported for ${service}` }));
        return;
    }

    const { getAllCategories, scrapeCategoryProducts } = scraper;


    logger.info('Starting category scraping', { cid, service });

    // Record metrics
    MetricsService.recordScrapingRequest(service, 'category');
    const durationTimer = MetricsService.recordScrapingRequest(service, 'category');

    try {
        // Wrap entire scraping operation with timeout
        await withTimeout(
            (async () => {
                console.log('[DEBUG] Sending "Fetching categories..."');
                socket.send(JSON.stringify({ action: 'statusUpdate', step: 'scrapeCategories', status: 'info', message: 'Fetching categories...' }));

                console.log('[DEBUG] Calling getAllCategories');
                const categories = await getAllCategories(excludedCategories || []);
                console.log(`[DEBUG] getAllCategories returned ${categories.length} categories`);

                // Filter by categoryFilter if provided (frontend 'categorySearchTerm')
                let targetCategories = categories;
                if (data.categoryFilter) {
                    const filterTerm = data.categoryFilter.toLowerCase();
                    console.log(`[DEBUG] Filtering categories by: "${filterTerm}"`);

                    // Create a "slug-like" version of the term for better matching 
                    // e.g. "Bread, & Eggs" -> "breadandeggs"
                    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const normalizedFilter = normalize(filterTerm);

                    targetCategories = categories.filter(c => {
                        const normName = normalize(c.name);
                        const normMain = normalize(c.mainCategory || '');
                        const normSub = normalize(c.subCategory || '');

                        return normName.includes(normalizedFilter) ||
                            normMain.includes(normalizedFilter) ||
                            normSub.includes(normalizedFilter);
                    });
                    console.log(`[DEBUG] Filter reduced categories from ${categories.length} to ${targetCategories.length}`);
                }

                socket.send(JSON.stringify({ action: 'statusUpdate', step: 'scrapeCategories', status: 'info', message: `Found ${targetCategories.length} categories to scrape` }));

                if (targetCategories.length === 0) {
                    console.log('[DEBUG] No categories found matching filter, stopping.');
                    socket.send(JSON.stringify({
                        action: 'statusUpdate', step: 'scrapeCategories',
                        status: 'completed',
                        message: 'No categories found matching criteria',
                        fileUrl: null,
                        totalProducts: 0
                    }));
                    return;
                }

                console.log('[DEBUG] Initializing browser for category scraping');
                const { page } = await BrowserPool.getOrInitBrowser(cid, service);
                console.log('[DEBUG] Browser initialized');

                const allProducts = [];
                let processedConfig = 0;

                for (const category of targetCategories) {
                    console.log(`[DEBUG] Processing category: ${category.name} (${processedConfig + 1}/${targetCategories.length})`);
                    // Check if client disconnected? BrowserPool might handle closing, but we might keep running?
                    // Ideally check session active.

                    socket.send(JSON.stringify({
                        action: 'statusUpdate', step: 'scrapeCategories',
                        status: 'progress',
                        message: `Scraping ${category.name}...`,
                        current: processedConfig + 1,
                        total: targetCategories.length,
                        categoryName: category.name,
                        mainCategory: category.mainCategory
                    }));

                    console.log('[DEBUG] Calling scrapeCategoryProducts');
                    const location = data.location || 'mumbai';

                    // For Instamart, use new Puppeteer scraping
                    // Other services use browser-based scraping
                    const products = await scrapeCategoryProducts(page, category.url, location);
                    console.log(`[DEBUG] scrapeCategoryProducts returned ${products.length} products`);

                    // If `products.realCategoryName` is set (Blinkit dynamic fix)
                    // update the category info if it looks like a placeholder
                    if (products.realCategoryName) {
                        if (category.mainCategory.startsWith('Cat-') && !category.mainCategory.includes(' > ')) {
                            category.mainCategory = products.realCategoryName;
                            category.name = `${products.realCategoryName} > ${category.subCategory}`; // Best effort update
                        }
                    }

                    // Add category info to products
                    const productsWithCat = products.map(p => ({
                        ...p,
                        category: products.realCategoryName || category.mainCategory, // Prefer dynamic name
                        subCategory: category.subCategory
                    }));

                    allProducts.push(...productsWithCat);
                    processedConfig++;

                    // Optional: Send intermediate results?
                    // socket.send(...)
                }

                console.log(`[DEBUG] Scraping finished. Generating Excel for ${allProducts.length} products`);

                // Generate Excel
                const writer = new CategoryExcelWriter();
                const buffer = await writer.generateExcel(allProducts);

                // Generate filename: zepto_category_(term)_(date).xlsx
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const searchTerm = data.categoryFilter ? data.categoryFilter.trim().replace(/\s+/g, '_') : 'categories';
                const fileName = `${service}_category_${searchTerm}_${timestamp}.xlsx`;

                // Convert buffer to base64
                const base64Data = buffer.toString('base64');
                console.log(`[DEBUG] Generated Excel base64 data (${base64Data.length} bytes)`);

                socket.send(JSON.stringify({
                    action: 'statusUpdate', step: 'scrapeCategories',
                    status: 'completed',
                    message: 'Scraping completed',
                    fileData: base64Data, // Send data directly
                    fileName: fileName,
                    totalProducts: allProducts.length
                }));
                console.log('[DEBUG] Sent completion message with file data');

                // Record success metrics
                MetricsService.recordScrapingSuccess(service, 'category', durationTimer);
            })(),
            config.timeouts.scrapingMs,
            'Category scraping'
        );

    } catch (error) {
        console.error('[DEBUG] Category scraping failed:', error);
        logger.error('Category scraping failed', { cid, error: error.message, errorCode: error.code });

        let errorMessage = error.message;

        // Handle specific error types
        if (isTimeoutError(error)) {
            errorMessage = `Scraping timed out after ${config.timeouts.scrapingMs / 1000} seconds. Please try scraping fewer categories or a smaller category.`;
            // Cleanup browser on timeout
            try {
                await BrowserPool.closeBrowser(cid, service);
            } catch (cleanupErr) {
                logger.error('Error cleaning up browser after timeout', { cid, error: cleanupErr.message });
            }
        } else if (error.code === 'BROWSER_LIMIT_PER_USER' || error.code === 'BROWSER_LIMIT_GLOBAL') {
            // Browser limit errors already have user-friendly messages
            errorMessage = error.message;
        }

        // Record failure metrics
        const failureReason = isTimeoutError(error) ? 'timeout' :
            (error.code === 'BROWSER_LIMIT_PER_USER' || error.code === 'BROWSER_LIMIT_GLOBAL') ? 'browser_limit' : 'error';
        MetricsService.recordScrapingFailure(service, 'category', failureReason, durationTimer);

        socket.send(JSON.stringify({
            action: 'statusUpdate',
            step: 'scrapeCategories',
            status: 'error',
            message: errorMessage
        }));
    }
}

module.exports = {
    handleScrapeCategories
};
