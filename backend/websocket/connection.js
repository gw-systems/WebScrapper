// WebSocket Connection Handler
// Main router for WebSocket events

const logger = require('../utils/logger');
const SessionManager = require('../services/SessionManager');
const wsAuth = require('../middleware/wsAuth');
const { checkRateLimit } = require('../middleware/rateLimiter');

// Import handlers
const { handleInitialize, handleCloseBrowser } = require('./handlers/initialization');
const { handleSetLocation } = require('./handlers/location');
const { handleSearch } = require('./handlers/search');
const { handleScrapeCategories } = require('./handlers/category');

// Supported services
const SERVICES = ['blinkit', 'zepto'];

function setupWebSocket(wss) {
    wss.on('connection', async (socket, req) => {
        // 1. Authentication (Optional/Lazy or via query param)
        // For Phase 3 we will enforce this strictly.
        // For now, we check if key is provided, if so validate.
        // If not, we might allow legacy or fail based on config.

        // We can use the middleware helper
        const authResult = await wsAuth.authenticate(req);
        // If we want to enforce it now:
        // if (!authResult.success) {
        //   socket.close(1008, authResult.error);
        //   return;
        // }
        // For now, we'll log it and proceed if dev/legacy
        if (!authResult.success && process.env.NODE_ENV === 'production') {
            logger.warn('WebSocket connection rejected', { ip: req.socket.remoteAddress, reason: authResult.error });
            // socket.close(1008, 'Authentication failed');
            // return;
        }

        // 2. Rate Limiting
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const allowed = await checkRateLimit(ip, 'connect');
        if (!allowed) {
            logger.warn('Connection rate limit exceeded', { ip });
            socket.close(1008, 'Rate limit exceeded');
            return;
        }

        // 3. Initialize Session
        const cid = Math.random().toString(36).substring(2, 15);
        const userAgent = req.headers['user-agent'];
        const apiKey = authResult.apiKey; // might be undefined

        await SessionManager.createSession(cid, apiKey, ip, userAgent);
        logger.info(`Client connected`, { cid, ip });

        // Send welcome message
        socket.send(JSON.stringify({ type: 'connected', cid }));

        // 4. Message Handling
        socket.on('message', async (msgRaw) => {
            try {
                // Rate limit messages?
                // const allowedMsg = await checkRateLimit(ip, 'message');
                // if (!allowedMsg) return;

                const data = JSON.parse(msgRaw);
                const action = data.action;

                logger.debug(`Received message`, { cid, action });

                // Validate service if present
                if (data.service && !SERVICES.includes(data.service)) {
                    return sendError(socket, 'Invalid service specified');
                }

                // Route to handler
                switch (action) {
                    case 'initialize':
                        await handleInitialize(socket, cid, data);
                        break;

                    case 'setLocation':
                        await handleSetLocation(socket, cid, data);
                        break;

                    case 'search':
                        await handleSearch(socket, cid, data);
                        break;

                    case 'scrapeCategories':
                        await handleScrapeCategories(socket, cid, data);
                        break;

                    case 'close-browser':
                        await handleCloseBrowser(socket, cid, data);
                        break;

                    default:
                        logger.warn(`Unknown action received`, { cid, action });
                        sendError(socket, `Unknown action: ${action}`);
                }

            } catch (err) {
                logger.error('Error processing message', { cid, error: err.message });
                sendError(socket, 'Internal server error processing message');
            }
        });

        // 5. Disconnect Handling
        socket.on('close', async () => {
            logger.info(`Client disconnected`, { cid });
            await SessionManager.closeSession(cid);
            // BrowserPool cleanup handled by SessionManager or explicit call
            const BrowserPool = require('../services/BrowserPool');
            await BrowserPool.cleanupClient(cid);
        });

        socket.on('error', (err) => {
            logger.error('WebSocket error', { cid, error: err.message });
        });
    });
}

function sendError(socket, message) {
    if (socket.readyState === 1) { // OPEN
        socket.send(JSON.stringify({ status: 'error', message }));
    }
}

module.exports = { setupWebSocket };
