const BrowserPool = require('../../services/BrowserPool');
const logger = require('../../utils/logger');
const config = require('../../config/environment');
const { withTimeout, isTimeoutError } = require('../../utils/timeout');
const MetricsService = require('../../services/MetricsService');
const zeptoSearch = require('../../zepto/searchHelpers');

// Try to import others, fail gracefully if missing
let blinkitSearch, instamartSearch;
try { blinkitSearch = require('../../blinkit/searchHelpers'); } catch (e) { }
// Instamart moved to standalone scraper

const searchHandlers = {
    zepto: zeptoSearch.scrapeProducts
};

const SERVICES = ['zepto'];

async function handleSearch(socket, cid, data) {
    console.log(`[DEBUG] handleSearch triggered for cid=${cid}`);
    // Support both param names for compatibility
    const searchTerm = data.searchTerm || data.query;
    const targetServices = data.service ? [data.service] : SERVICES;

    console.log(`[DEBUG] Search term: "${searchTerm}", Services: ${targetServices.join(', ')}`);

    if (!searchTerm) {
        console.log('[DEBUG] No search term provided');
        socket.send(JSON.stringify({
            action: 'statusUpdate',
            step: 'search',
            status: 'error',
            message: 'Search term is required'
        }));
        return;
    }

    logger.info(`Searching for "${searchTerm}" on: ${targetServices.join(', ')}`, { cid });

    // Notify start
    socket.send(JSON.stringify({
        action: 'statusUpdate',
        step: 'search',
        status: 'loading',
        message: `Searching for "${searchTerm}"...`
    }));

    // Helper to send updates
    const sendUpdate = (service, status, message, products = null) => {
        console.log(`[DEBUG] sendUpdate: ${service} -> ${status} (${message})`);
        socket.send(JSON.stringify({
            action: 'serviceSearchUpdate',
            service,
            status,
            message,
            hasProducts: products ? products.length > 0 : false,
            products // Send products incrementally
        }));
    };

    // Run in parallel
    await Promise.all(targetServices.map(async (svc) => {
        // Initial loading state
        sendUpdate(svc, 'loading', `Searching ${svc}...`);

        try {
            console.log(`[DEBUG] Starting search for service: ${svc}`);

            // Record metrics
            MetricsService.recordScrapingRequest(svc, 'search');
            const durationTimer = MetricsService.recordScrapingRequest(svc, 'search');

            const handler = searchHandlers[svc];
            if (!handler) {
                console.log(`[DEBUG] No handler for service: ${svc}`);
                sendUpdate(svc, 'skipped', `Service ${svc} not supported yet`);
                return;
            }

            // Wrap search with timeout
            await withTimeout(
                (async () => {
                    console.log(`[DEBUG] Getting browser for ${svc}`);
                    const { page } = await BrowserPool.getOrInitBrowser(cid, svc);
                    console.log(`[DEBUG] Browser obtained for ${svc}, invoking handler`);

                    const products = await handler(page, searchTerm);
                    console.log(`[DEBUG] Handler returned ${products?.length} products for ${svc}`);

                    sendUpdate(svc, 'completed', `Found ${products.length} products`, products || []);

                    // Record success metrics
                    MetricsService.recordScrapingSuccess(svc, 'search', durationTimer);
                })(),
                config.timeouts.searchMs,
                `Search on ${svc}`
            );

        } catch (error) {
            console.error(`[DEBUG] Search failed for ${svc}:`, error);
            logger.error(`Search failed for ${svc}`, { cid, error: error.message, errorCode: error.code });

            let errorMessage = error.message;

            // Handle specific error types
            if (isTimeoutError(error)) {
                errorMessage = `Search timed out after ${config.timeouts.searchMs / 1000} seconds`;
                // Cleanup browser on timeout
                try {
                    await BrowserPool.closeBrowser(cid, svc);
                } catch (cleanupErr) {
                    logger.error('Error cleaning up browser after timeout', { cid, error: cleanupErr.message });
                }
            } else if (error.code === 'BROWSER_LIMIT_PER_USER' || error.code === 'BROWSER_LIMIT_GLOBAL') {
                errorMessage = error.message;
            }

            // Record failure metrics
            const failureReason = isTimeoutError(error) ? 'timeout' :
                (error.code === 'BROWSER_LIMIT_PER_USER' || error.code === 'BROWSER_LIMIT_GLOBAL') ? 'browser_limit' : 'error';
            MetricsService.recordScrapingFailure(svc, 'search', failureReason, durationTimer);

            sendUpdate(svc, 'error', `Search failed: ${errorMessage}`);
        }
    }));

    console.log('[DEBUG] Search finished, sending completion');
    // Final completion message
    socket.send(JSON.stringify({
        action: 'statusUpdate',
        step: 'search',
        status: 'completed',
        message: 'Search completed'
    }));
}

module.exports = {
    handleSearch
};
