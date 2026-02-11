// Browser Pool Service
// Manages Puppeteer browser instances with TTL and resource limits

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const config = require('../config/environment');
const logger = require('../utils/logger');

// Pool of realistic User-Agents for rotation (prevents anti-bot detection)
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
];

class BrowserPool {
    constructor() {
        this.browsers = new Map(); // clientId -> { service: { browser, page, lastUsed } }
        this.contexts = new Map(); // contextId -> { browser, context, page, lastUsed, service }
        this.cleanupInterval = null;
        this.isShuttingDown = false;

        // Start cleanup job
        this.startCleanupJob();
    }

    /**
     * Get a random User-Agent from the pool
     * @returns {string} Random User-Agent string
     */
    getRandomUserAgent() {
        return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
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
                        `--user-agent=${this.getRandomUserAgent()}`
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
     * Create an isolated browser context for a scraping session
     * This prevents race conditions when multiple sessions run concurrently
     * @param {string} contextId - Unique ID for this context (usually cid + timestamp)
     * @param {string} service - Service name (zepto, blinkit, etc.)
     * @returns {Promise<{browser, context, page}>}
     */
    async getOrCreateContext(contextId, service) {
        if (this.isShuttingDown) {
            throw new Error('Service is shutting down');
        }

        // Return existing context if available
        if (this.contexts.has(contextId)) {
            const resource = this.contexts.get(contextId);
            if (resource.browser && resource.browser.isConnected() && resource.context) {
                resource.lastUsed = Date.now();
                return { browser: resource.browser, context: resource.context, page: resource.page };
            }
            // If disconnected, clean up
            await this.closeContext(contextId);
        }

        // Check browser pool limits
        const totalBrowsers = this.getTotalBrowserCount();
        const totalContexts = this.contexts.size;

        if (totalContexts >= config.browserPool.maxBrowsersTotal * 2) {
            const error = new Error(
                `Context limit reached: ${totalContexts} active contexts. ` +
                `Please try again in a few moments.`
            );
            error.code = 'CONTEXT_LIMIT';
            logger.warn('Context limit reached', { contextId, totalContexts });
            throw error;
        }

        logger.info(`Creating new isolated context for ${service}`, { contextId });

        // Get or create a shared browser for this service
        // We'll use a special "shared" client ID for context-based scraping
        const sharedClientId = `shared_${service}`;
        const { browser } = await this.getOrInitBrowser(sharedClientId, service);

        try {
            // Create incognito context for isolation
            const context = await browser.createBrowserContext();
            const page = await context.newPage();

            // Set random User-Agent for this context
            await page.setUserAgent(this.getRandomUserAgent());

            // Apply same optimizations as regular pages
            await page.setRequestInterception(true);
            page.on("request", (req) => {
                const resourceType = req.resourceType();
                if (["image", "font", "media"].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            // Store context
            this.contexts.set(contextId, {
                browser,
                context,
                page,
                service,
                lastUsed: Date.now(),
                createdAt: Date.now()
            });

            logger.info(`Context created successfully`, { contextId, service });
            return { browser, context, page };
        } catch (error) {
            logger.error(`Failed to create context for ${service}`, { contextId, error: error.message });
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
     * Close a specific browser context
     * @param {string} contextId - The context ID to close
     */
    async closeContext(contextId) {
        if (this.contexts.has(contextId)) {
            const resource = this.contexts.get(contextId);
            try {
                // Close all pages in the context
                const pages = await resource.context.pages();
                await Promise.all(pages.map(p => p.close().catch(err =>
                    logger.warn('Error closing page in context', { contextId, error: err.message })
                )));

                // Close the context itself
                await resource.context.close();

                logger.info('Closed browser context', { contextId, service: resource.service });
            } catch (err) {
                logger.warn('Error closing context', { contextId, error: err.message });
            }
            this.contexts.delete(contextId);
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

            // Cleanup idle contexts
            for (const [contextId, resource] of this.contexts.entries()) {
                if (now - resource.lastUsed > ttl) {
                    logger.info(`Closing idle context for ${resource.service}`, { contextId, idleTime: now - resource.lastUsed });
                    await this.closeContext(contextId);
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

        // Close all contexts
        const contextClosingPromises = [];
        for (const contextId of this.contexts.keys()) {
            contextClosingPromises.push(this.closeContext(contextId));
        }
        await Promise.all(contextClosingPromises);

        logger.info('BrowserPool shutdown complete');
    }
}

// Singleton instance
module.exports = new BrowserPool();
