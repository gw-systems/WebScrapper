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
            const { browser, page } = clientResources[service];
            if (browser.isConnected()) {
                clientResources[service].lastUsed = Date.now();
                return { browser, page };
            }
            // If disconnected, clean up reference
            this.clearService(clientId, service);
        }

        // Check pool limits (global or per user - for now just check memory implicitly by limiting max browsers if strictly needed, 
        // but here we are basically limiting by active clients implicitly via server capacity)
        // Real strict limiting would count total instances across all clients.

        logger.info(`Initializing new ${service} browser`, { clientId });

        try {
            const browser = await puppeteer.launch({
                headless: "new", // Run in headless mode
                defaultViewport: null, // Open with full window size
                args: [
                    "--start-maximized", // Maximize window
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-accelerated-2d-canvas",
                    "--disable-gpu",
                    "--window-size=1920,1080"
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

            // Store in pool
            clientResources[service] = {
                browser,
                page,
                lastUsed: Date.now(),
                createdAt: Date.now()
            };

            return { browser, page };
        } catch (error) {
            logger.error(`Failed to initialize browser for ${service}`, { clientId, error: error.message });
            throw error;
        }
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
