// Metrics Service
// Centralized Prometheus metrics collection

const client = require('prom-client');
const logger = require('../utils/logger');

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({ register });

// ============================================================================
// CUSTOM METRICS
// ============================================================================

// Counters
const scrapingRequestsTotal = new client.Counter({
    name: 'scraping_requests_total',
    help: 'Total number of scraping requests',
    labelNames: ['service', 'type'], // type: 'search' or 'category'
    registers: [register]
});

const scrapingSuccessTotal = new client.Counter({
    name: 'scraping_success_total',
    help: 'Total number of successful scraping operations',
    labelNames: ['service', 'type'],
    registers: [register]
});

const scrapingFailuresTotal = new client.Counter({
    name: 'scraping_failures_total',
    help: 'Total number of failed scraping operations',
    labelNames: ['service', 'type', 'reason'], // reason: 'timeout', 'browser_limit', 'error'
    registers: [register]
});

const websocketConnectionsTotal = new client.Counter({
    name: 'websocket_connections_total',
    help: 'Total number of WebSocket connections',
    labelNames: ['status'], // status: 'accepted' or 'rejected'
    registers: [register]
});

const browserInitializationsTotal = new client.Counter({
    name: 'browser_initializations_total',
    help: 'Total number of browser initializations',
    labelNames: ['service'],
    registers: [register]
});

// Gauges
const activeBrowsersGauge = new client.Gauge({
    name: 'active_browsers',
    help: 'Number of currently active browser instances',
    registers: [register]
});

const activeSessionsGauge = new client.Gauge({
    name: 'active_sessions',
    help: 'Number of currently active WebSocket sessions',
    registers: [register]
});

const browserPoolUtilizationGauge = new client.Gauge({
    name: 'browser_pool_utilization_percent',
    help: 'Browser pool utilization as a percentage',
    registers: [register]
});

// Histograms
const scrapingDurationHistogram = new client.Histogram({
    name: 'scraping_duration_seconds',
    help: 'Duration of scraping operations in seconds',
    labelNames: ['service', 'type'],
    buckets: [1, 5, 10, 30, 60, 120, 180, 300], // 1s to 5min
    registers: [register]
});

const requestDurationHistogram = new client.Histogram({
    name: 'request_duration_seconds',
    help: 'Duration of HTTP/WebSocket requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register]
});

const browserInitDurationHistogram = new client.Histogram({
    name: 'browser_init_duration_seconds',
    help: 'Duration of browser initialization in seconds',
    labelNames: ['service'],
    buckets: [1, 3, 5, 10, 15, 30],
    registers: [register]
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Record a scraping request start
 */
function recordScrapingRequest(service, type) {
    scrapingRequestsTotal.labels(service, type).inc();
    return scrapingDurationHistogram.startTimer({ service, type });
}

/**
 * Record a successful scraping operation
 */
function recordScrapingSuccess(service, type, durationTimer) {
    scrapingSuccessTotal.labels(service, type).inc();
    if (durationTimer) durationTimer();
}

/**
 * Record a failed scraping operation
 */
function recordScrapingFailure(service, type, reason, durationTimer) {
    scrapingFailuresTotal.labels(service, type, reason).inc();
    if (durationTimer) durationTimer();
}

/**
 * Record WebSocket connection
 */
function recordWebSocketConnection(accepted = true) {
    websocketConnectionsTotal.labels(accepted ? 'accepted' : 'rejected').inc();
}

/**
 * Record browser initialization
 */
function recordBrowserInit(service) {
    browserInitializationsTotal.labels(service).inc();
    return browserInitDurationHistogram.startTimer({ service });
}

/**
 * Update active browsers gauge
 */
function updateActiveBrowsers(count) {
    activeBrowsersGauge.set(count);
}

/**
 * Update active sessions gauge
 */
function updateActiveSessions(count) {
    activeSessionsGauge.set(count);
}

/**
 * Update browser pool utilization
 */
function updateBrowserPoolUtilization(percent) {
    browserPoolUtilizationGauge.set(percent);
}

/**
 * Update browser pool metrics from BrowserPool stats
 */
function updateBrowserPoolMetrics(stats) {
    updateActiveBrowsers(stats.totalBrowsers);
    updateBrowserPoolUtilization(stats.utilizationPercent);
}

/**
 * Get metrics for Prometheus scraping
 */
async function getMetrics() {
    return register.metrics();
}

/**
 * Get metrics content type
 */
function getContentType() {
    return register.contentType;
}

module.exports = {
    // Recording functions
    recordScrapingRequest,
    recordScrapingSuccess,
    recordScrapingFailure,
    recordWebSocketConnection,
    recordBrowserInit,

    // Update functions
    updateActiveBrowsers,
    updateActiveSessions,
    updateBrowserPoolUtilization,
    updateBrowserPoolMetrics,

    // Export functions
    getMetrics,
    getContentType,

    // Direct access to metrics (for advanced use)
    metrics: {
        scrapingRequestsTotal,
        scrapingSuccessTotal,
        scrapingFailuresTotal,
        websocketConnectionsTotal,
        browserInitializationsTotal,
        activeBrowsersGauge,
        activeSessionsGauge,
        browserPoolUtilizationGauge,
        scrapingDurationHistogram,
        requestDurationHistogram,
        browserInitDurationHistogram
    }
};
