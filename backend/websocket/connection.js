// WebSocket Connection Handler
// Main router for WebSocket events

const logger = require('../utils/logger');
const SessionManager = require('../services/SessionManager');
const wsAuth = require('../middleware/wsAuth');
const { checkRateLimit } = require('../middleware/rateLimiter');
const MetricsService = require('../services/MetricsService');

// Import handlers
const { handleInitialize, handleCloseBrowser } = require('./handlers/initialization');
const { handleSetLocation } = require('./handlers/location');
const { handleSearch } = require('./handlers/search');
const { handleScrapeCategories } = require('./handlers/category');

// Supported services
const SERVICES = ['blinkit', 'zepto'];

function setupWebSocket(wss) {
    wss.on('connection', async (socket, req) => {
        // 1. Authentication
        const authResult = await wsAuth.authenticate(req);

        // Enforce authentication in production
        if (!authResult.success) {
            if (process.env.NODE_ENV === 'production') {
                logger.warn('WebSocket connection rejected - authentication failed', {
                    ip: req.socket.remoteAddress,
                    reason: authResult.error
                });
                MetricsService.recordWebSocketConnection(false);
                socket.close(1008, authResult.error);
                return;
            } else {
                // Log warning in development but allow connection
                logger.debug('WebSocket connection without authentication (development mode)', {
                    ip: req.socket.remoteAddress
                });
            }
        }

        // 2. Rate Limiting
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const allowed = await checkRateLimit(ip, 'connect');
        if (!allowed) {
            logger.warn('Connection rate limit exceeded', { ip });
            MetricsService.recordWebSocketConnection(false);
            socket.close(1008, 'Rate limit exceeded');
            return;
        }

        // 3. Initialize Session
        const cid = Math.random().toString(36).substring(2, 15);
        const userAgent = req.headers['user-agent'];
        const apiKey = authResult.apiKey; // might be undefined

        await SessionManager.createSession(cid, apiKey, ip, userAgent);
        logger.info(`Client connected`, { cid, ip });

        // Record successful connection
        MetricsService.recordWebSocketConnection(true);
        MetricsService.updateActiveSessions(SessionManager.getActiveSessionCount());

        // Send welcome message
        socket.send(JSON.stringify({ type: 'connected', cid }));

        // 4. Message Handling
        socket.on('message', async (msgRaw) => {
            try {
                // Parse message
                const data = JSON.parse(msgRaw);

                // Validate message using validation middleware
                const { validateWebSocketMessage } = require('../middleware/validation');
                const validation = validateWebSocketMessage(data);

                if (!validation.valid) {
                    logger.warn('WebSocket message validation failed', {
                        cid,
                        error: validation.error,
                        action: data.action
                    });
                    return sendError(socket, validation.error);
                }

                // Use validated data
                const validatedData = validation.data;
                const action = validatedData.action;

                // Rate limit messages (optional but recommended)
                const allowedMsg = await checkRateLimit(ip, 'message');
                if (!allowedMsg) {
                    logger.warn('Message rate limit exceeded', { cid, ip });
                    sendError(socket, 'Rate limit exceeded');
                    socket.close(1008, 'Rate limit exceeded');
                    return;
                }

                logger.debug(`Received message`, { cid, action });

                // Service validation already done by Joi schema
                // Route to handler using validated data
                switch (action) {
                    case 'initialize':
                        await handleInitialize(socket, cid, validatedData);
                        break;

                    case 'setLocation':
                        await handleSetLocation(socket, cid, validatedData);
                        break;

                    case 'search':
                        await handleSearch(socket, cid, validatedData);
                        break;

                    case 'scrapeCategories':
                        await handleScrapeCategories(socket, cid, validatedData);
                        break;

                    case 'close-browser':
                        await handleCloseBrowser(socket, cid, validatedData);
                        break;

                    default:
                        // This should never happen due to Joi validation
                        logger.warn(`Unknown action received`, { cid, action });
                        sendError(socket, `Unknown action: ${action}`);
                }

            } catch (err) {
                if (err instanceof SyntaxError) {
                    logger.warn('Invalid JSON in WebSocket message', { cid });
                    return sendError(socket, 'Invalid JSON format');
                }
                logger.error('Error processing message', { cid, error: err.message });
                sendError(socket, 'Internal server error processing message');
            }
        });

        // 5. Disconnect Handling
        socket.on('close', async () => {
            logger.info(`Client disconnected`, { cid });
            await SessionManager.closeSession(cid);

            // Update session metrics
            MetricsService.updateActiveSessions(SessionManager.getActiveSessionCount());

            // BrowserPool cleanup handled by SessionManager or explicit call
            const BrowserPool = require('../services/BrowserPool');
            await BrowserPool.cleanupClient(cid);

            // Update browser pool metrics
            MetricsService.updateBrowserPoolMetrics(BrowserPool.getStats());
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
