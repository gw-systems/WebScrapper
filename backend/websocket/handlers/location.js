const BrowserPool = require('../../services/BrowserPool');
const SessionManager = require('../../services/SessionManager');
const logger = require('../../utils/logger');

// Import service helpers dynamically
const zeptoLocation = require('../../zepto/set-location');
const blinkitLocation = require('../../blinkit/set-location');
// Instamart moved to standalone scraper

// Map handlers
const locationHandlers = {
    zepto: zeptoLocation.setZeptoLocation,
    blinkit: blinkitLocation.setBlinkitLocation
};

// Supported services list
const SERVICES = ['zepto', 'blinkit'];

async function handleSetLocation(socket, cid, data) {
    const { location } = data;
    let { service } = data;

    // If no service specified, target all supported services
    const targetServices = service ? [service] : SERVICES;

    if (!location) {
        socket.send(JSON.stringify({
            action: 'statusUpdate',
            step: 'setLocation',
            status: 'error',
            message: 'Location is required'
        }));
        return;
    }

    logger.info(`Setting location for services: ${targetServices.join(', ')}`, { cid, location });

    // Notify start
    socket.send(JSON.stringify({
        action: 'statusUpdate',
        step: 'setLocation',
        status: 'loading',
        message: `Setting location to "${location}"...`
    }));

    // Execute in parallel
    // Execute sequentially to avoid resource contention
    // const locationPromises = targetServices.map(async (svc) => { ... });
    const results = [];

    for (const svc of targetServices) {
        try {
            // Standard handling for all services (Zepto, Blinkit, Instamart)
            const handler = locationHandlers[svc];
            if (!handler) {
                logger.warn(`Location handler for ${svc} not implemented yet`, { cid });
                results.push({ service: svc, success: false, error: 'Service not supported yet' });
                continue;
            }

            // High-level Retry Loop (for non-Instamart services)
            const MAX_SERVICE_RETRIES = 1;
            let serviceSuccess = false;
            let serviceResult = null;
            let serviceError = null;

            for (let attempt = 1; attempt <= MAX_SERVICE_RETRIES; attempt++) {
                try {
                    // Get browser page from pool
                    const { page } = await BrowserPool.getOrInitBrowser(cid, svc);

                    // Execute handler
                    const result = await handler(page, location);

                    if (result) {
                        SessionManager.setLocationStatus(cid, svc, true);
                        results.push({ service: svc, success: true, location: result });
                        serviceSuccess = true;
                        break; // Success, exit retry loop
                    } else {
                        // Verification failed inside handler
                        serviceError = 'Verification failed';
                    }
                } catch (err) {
                    serviceError = err.message;
                    logger.error(`${svc} attempt ${attempt} failed`, { cid, error: err.message });
                }
            }

            if (!serviceSuccess) {
                results.push({ service: svc, success: false, error: serviceError || 'Failed after retries' });
            }

        } catch (error) {
            logger.error(`Location set logic error for ${svc}`, { cid, error: error.message });
            results.push({ service: svc, success: false, error: error.message });
        }
    }

    // const results = await Promise.all(locationPromises);

    // const results = await Promise.all(locationPromises);

    // Send aggregated results to frontend
    socket.send(JSON.stringify({
        action: 'statusUpdate',
        step: 'setLocation',
        status: 'completed',
        locationResults: results,
    }));
}

module.exports = {
    handleSetLocation
};
