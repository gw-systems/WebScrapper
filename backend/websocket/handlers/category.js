const BrowserPool = require('../../services/BrowserPool');
const logger = require('../../utils/logger');
const { getAllCategories, scrapeCategoryProducts } = require('../../zepto/categoryScraper');
const CategoryExcelWriter = require('../../excelWriter'); // We need to check where this lives
const fs = require('fs');
const path = require('path');

async function handleScrapeCategories(socket, cid, data) {
    console.log(`[DEBUG] handleScrapeCategories triggered for cid=${cid}`);
    const { service, excludedCategories } = data;
    console.log(`[DEBUG] Service: ${service}, Excluded: ${JSON.stringify(excludedCategories)}`);

    if (service !== 'zepto') {
        console.log(`[DEBUG] Invalid service: ${service}`);
        socket.send(JSON.stringify({ status: 'error', message: 'Only Zepto supported for category scraping' }));
        return;
    }

    logger.info('Starting category scraping', { cid, service });

    try {
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
            targetCategories = categories.filter(c =>
                c.name.toLowerCase().includes(filterTerm) ||
                c.mainCategory.toLowerCase().includes(filterTerm) ||
                c.subCategory.toLowerCase().includes(filterTerm)
            );
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
            const products = await scrapeCategoryProducts(page, category.url);
            console.log(`[DEBUG] scrapeCategoryProducts returned ${products.length} products`);

            // Add category info to products
            const productsWithCat = products.map(p => ({
                ...p,
                category: category.mainCategory,
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

        // Convert to Base64 for client-side download (avoid saving to server disk)
        const base64Data = buffer.toString('base64');

        // Generate filename: zepto_search_(term)_(date)_(time).xlsx
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const searchTerm = data.categoryFilter ? data.categoryFilter.trim().replace(/\s+/g, '_') : 'categories';
        const fileName = `zepto_search_${searchTerm}_${timestamp}.xlsx`;

        socket.send(JSON.stringify({
            action: 'statusUpdate', step: 'scrapeCategories',
            status: 'completed',
            message: 'Scraping completed',
            fileData: base64Data, // Send file content directly
            fileName: fileName,
            totalProducts: allProducts.length
        }));
        console.log('[DEBUG] Sent completion message with Excel data');

    } catch (error) {
        console.error('[DEBUG] Category scraping failed:', error);
        logger.error('Category scraping failed', { cid, error: error.message });
        socket.send(JSON.stringify({ action: 'statusUpdate', step: 'scrapeCategories', status: 'error', message: error.message }));
    }
}

module.exports = {
    handleScrapeCategories
};
