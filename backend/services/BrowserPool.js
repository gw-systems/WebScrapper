// Browser Pool Service
// Manages Puppeteer browser instances with TTL and resource limits

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const config = require('../config/environment');
const logger = require('../utils/logger');

class BrowserPool {
    constructor() {
        this.browsers = new Map(); // clientId -> { service: { browser, page, lastUsed } }
        this.cleanupInterval = null;
        this.isShuttingDown = false;

        // Start cleanup job
        this.startCleanupJob();
    }

    /**
     * Initialize a browser for a client and service
     * @param {string} clientId 
     * @param {string} service 
     * @returns {Promise<{browser, page}>}
     */
    async getOrInitBrowser(clientId, service) {
        if (this.isShuttingDown) {
            throw new Error('Service is shutting down');
        }

        if (!this.browsers.has(clientId)) {
            this.browsers.set(clientId, {});
        }

        const clientResources = this.browsers.get(clientId);

        // Return existing if available and connected
        if (clientResources[service]) {
            const resource = clientResources[service];

            // If initialization is in progress, wait for it
            if (resource.initializationPromise) {
                logger.info(`Waiting for pending ${service} browser initialization`, { clientId });
                return resource.initializationPromise;
            }

            const { browser, page } = resource;
            if (browser && browser.isConnected()) {
                resource.lastUsed = Date.now();
                return { browser, page };
            }
            // If disconnected, clean up reference
            this.clearService(clientId, service);
        }

        // Check browser pool limits before creating new browser
        const currentUserBrowsers = Object.keys(clientResources).length;
        const totalBrowsers = this.getTotalBrowserCount();

        // Per-user limit check
        if (currentUserBrowsers >= config.browserPool.maxBrowsersPerUser) {
            const error = new Error(
                `Browser limit reached: You have ${currentUserBrowsers} active browsers ` +
                `(max ${config.browserPool.maxBrowsersPerUser} per user). ` +
                `Please close an existing browser before opening a new one.`
            );
            error.code = 'BROWSER_LIMIT_PER_USER';
            logger.warn('Per-user browser limit reached', {
                clientId,
                currentUserBrowsers,
                maxPerUser: config.browserPool.maxBrowsersPerUser
            });
            throw error;
        }

        // Global limit check
        if (totalBrowsers >= config.browserPool.maxBrowsersTotal) {
            const error = new Error(
                `Server browser limit reached: ${totalBrowsers} browsers active ` +
                `(max ${config.browserPool.maxBrowsersTotal}). ` +
                `Please try again in a few moments.`
            );
            error.code = 'BROWSER_LIMIT_GLOBAL';
            logger.warn('Global browser limit reached', {
                clientId,
                totalBrowsers,
                maxTotal: config.browserPool.maxBrowsersTotal
            });
            throw error;
        }


        logger.info(`Initializing new ${service} browser`, { clientId });
        console.log(`[BrowserPool] Launching headful browser for ${service} with Chrome 124 UA...`);

        // Record browser initialization start
        const MetricsService = require('./MetricsService');
        MetricsService.recordBrowserInit(service);
        const initTimer = MetricsService.recordBrowserInit(service);

        // Create initialization promise
        const initPromise = (async () => {
            try {
                const browser = await puppeteer.launch({
                    headless: true,
                    defaultViewport: { width: 1920, height: 1080 },
                    args: [
                        "--start-maximized", // Maximize window
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-accelerated-2d-canvas",
                        "--disable-gpu",
                        "--window-size=1920,1080",
                        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                    ],
                });

                const page = await browser.newPage();

                // Basic page resource optimization
                await page.setRequestInterception(true);
                page.on("request", (req) => {
                    const resourceType = req.resourceType();
                    if (["image", "font", "media"].includes(resourceType)) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                // Update resource with actual browser instance
                clientResources[service] = {
                    browser,
                    page,
                    lastUsed: Date.now(),
                    createdAt: Date.now(),
                    initializationPromise: null // Clear promise
                };

                // Stop init timer and update browser pool metrics
                initTimer();
                const stats = this.getStats();
                MetricsService.updateBrowserPoolMetrics(stats);

                return { browser, page };
            } catch (error) {
                // Clean up placeholder if failed
                if (clientResources[service] && clientResources[service].initializationPromise) {
                    delete clientResources[service];
                }
                logger.error(`Failed to initialize browser for ${service}`, { clientId, error: error.message });
                throw error;
            }
        })();

        // Store promise to block other requests
        clientResources[service] = {
            initializationPromise: initPromise,
            lastUsed: Date.now()
        };

        return initPromise;
    }

    /**
     * Get existing page for client/service
     */
    getPage(clientId, service) {
        const resources = this.browsers.get(clientId);
        if (resources && resources[service]) {
            resources[service].lastUsed = Date.now();
            return resources[service].page;
        }
        return null;
    }

    /**
     * Close specific service browser for a client
     */
    async closeBrowser(clientId, service) {
        if (this.browsers.has(clientId)) {
            const resources = this.browsers.get(clientId);
            if (resources[service]) {
                try {
                    const { browser } = resources[service];
                    if (browser && browser.isConnected()) {
                        await browser.close();
                    }
                } catch (err) {
                    logger.warn(`Error closing browser for ${service}`, { clientId, error: err.message });
                }
                delete resources[service];
                logger.info(`Closed ${service} browser`, { clientId });
            }
        }
    }

    /**
     * Close all browsers for a client (cleanup on disconnect)
     */
    async cleanupClient(clientId) {
        if (this.browsers.has(clientId)) {
            const resources = this.browsers.get(clientId);
            const services = Object.keys(resources);

            await Promise.all(services.map(svc => this.closeBrowser(clientId, svc)));

            this.browsers.delete(clientId);
            logger.info(`Cleaned up all resources for client`, { clientId });
        }
    }

    /**
     * Get total browser count across all clients
     * @returns {number}
     */
    getTotalBrowserCount() {
        let count = 0;
        for (const services of this.browsers.values()) {
            count += Object.keys(services).length;
        }
        return count;
    }

    /**
     * Get browser pool statistics
     * @returns {Object}
     */
    getStats() {
        const totalBrowsers = this.getTotalBrowserCount();
        const activeClients = this.browsers.size;
        const stats = {
            totalBrowsers,
            activeClients,
            maxBrowsersTotal: config.browserPool.maxBrowsersTotal,
            maxBrowsersPerUser: config.browserPool.maxBrowsersPerUser,
            utilizationPercent: (totalBrowsers / config.browserPool.maxBrowsersTotal) * 100,
            clients: []
        };

        for (const [clientId, services] of this.browsers.entries()) {
            stats.clients.push({
                clientId,
                browserCount: Object.keys(services).length,
                services: Object.keys(services)
            });
        }

        return stats;
    }

    /**
     * Clean references without closing (if separate cleanup needed)
     */
    clearService(clientId, service) {
        if (this.browsers.has(clientId)) {
            const resources = this.browsers.get(clientId);
            delete resources[service];
        }
    }

    /**
     * Periodic job to close idle browsers
     */
    startCleanupJob() {
        // Run every minute
        this.cleanupInterval = setInterval(async () => {
            const now = Date.now();
            const ttl = config.browserPool.ttlMs;

            // Iterate all clients and services
            for (const [clientId, services] of this.browsers.entries()) {
                for (const [serviceName, resource] of Object.entries(services)) {
                    if (now - resource.lastUsed > ttl) {
                        logger.info(`Closing idle browser for ${serviceName}`, { clientId, idleTime: now - resource.lastUsed });
                        await this.closeBrowser(clientId, serviceName);
                    }
                }

                // If client has no open browsers, remove client entry
                if (Object.keys(services).length === 0) {
                    this.browsers.delete(clientId);
                }
            }
        }, 60000);
    }

    /**
     * Graceful shutdown of all browsers
     */
    async shutdown() {
        this.isShuttingDown = true;
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);

        const closingPromises = [];
        for (const [clientId, services] of this.browsers.entries()) {
            for (const serviceName of Object.keys(services)) {
                closingPromises.push(this.closeBrowser(clientId, serviceName));
            }
        }

        await Promise.all(closingPromises);
        logger.info('BrowserPool shutdown complete');
    }
}

// Singleton instance
module.exports = new BrowserPool();
