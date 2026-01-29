const BrowserPool = require('../../services/BrowserPool');
const SessionManager = require('../../services/SessionManager');
const logger = require('../../utils/logger');

// Import service helpers dynamically
const zeptoLocation = require('../../zepto/set-location');
const blinkitLocation = require('../../blinkit/set-location');
const instamartLocation = require('../../instamart/set-location');

// Map handlers
const locationHandlers = {
    zepto: zeptoLocation.setZeptoLocation,
    blinkit: blinkitLocation.setBlinkitLocation,
    instamart: instamartLocation.setInstamartLocation
};

// Supported services list
const SERVICES = ['zepto', 'blinkit', 'instamart'];

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
    const locationPromises = targetServices.map(async (svc) => {
        try {
            // Check if handler exists
            const handler = locationHandlers[svc];
            if (!handler) {
                logger.warn(`Location handler for ${svc} not implemented yet`, { cid });
                return { service: svc, success: false, error: 'Service not supported yet' };
            }

            // Get browser page from pool
            const { page } = await BrowserPool.getOrInitBrowser(cid, svc);

            // Execute handler
            const result = await handler(page, location);

            if (result) {
                SessionManager.setLocationStatus(cid, svc, true);
                return { service: svc, success: true, location: result };
            } else {
                return { service: svc, success: false, error: 'Verification failed' };
            }

        } catch (error) {
            logger.error(`Location set failed for ${svc}`, { cid, error: error.message });
            return { service: svc, success: false, error: error.message };
        }
    });

    const results = await Promise.all(locationPromises);

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
