// Web Scraper Backend Server
// Refactored modular server entry point

const express = require('express');
const http = require('http');
const ws = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const config = require('./config/environment');
const logger = require('./utils/logger');
const { setupWebSocket } = require('./websocket/connection');
const { testConnection, closePool } = require('./config/database');
const BrowserPool = require('./services/BrowserPool');
const { globalLimiter, strictLimiter } = require('./middleware/httpRateLimiter');

// Create App
const app = express();
const server = http.createServer(app);
const wss = new ws.Server({ server });

// Trust proxy - needed for rate limiting to work correctly behind proxies
// Set to 1 if behind a single proxy, or 'loopback' for development
app.set('trust proxy', config.isProduction ? 1 : 'loopback');

// Configuration
// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", config.frontendUrl],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for WebSocket
}));

// CORS - Strict in production, permissive in development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (config.isProduction) {
      // Production: Only allow specific frontend URL
      if (origin === config.frontendUrl) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked request', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // Development: Allow localhost on any port
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply global rate limiter
app.use('/api/', globalLimiter);

// Request logging
app.use(morgan('dev', {
  stream: { write: message => logger.info(message.trim()) }
}));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Setup WebSocket
setupWebSocket(wss);

// Routes
const instamartRoutes = require('./routes/instamart');
const exportRoutes = require('./routes/export');

// Apply strict rate limiter to scraping endpoint
app.use('/api/instamart/scrape', strictLimiter);
app.use('/api/instamart', instamartRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv
  });
});

// Metrics endpoints
const MetricsService = require('./services/MetricsService');

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', MetricsService.getContentType());
    const metrics = await MetricsService.getMetrics();
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message });
    res.status(500).send('Error generating metrics');
  }
});

app.get('/api/stats', (req, res) => {
  const browserStats = BrowserPool.getStats();
  res.json({
    browserPool: browserStats,
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled express error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
async function startServer() {
  try {
    // 1. Connect to Database
    if (config.isProduction || process.env.DB_HOST) {
      try {
        await testConnection();
        logger.info('Database connected successfully');
      } catch (dbErr) {
        logger.error('Database connection failed - continuing without DB persistence', { error: dbErr.message });
      }
    }

    // 2. Start Listening
    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
      logger.info(`Frontend URL: ${config.frontendUrl}`);
    });

    // 3. Graceful Shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

async function shutdown() {
  logger.info('Shutting down...');

  // Close WebSocket server
  wss.close(() => logger.info('WebSocket server closed'));

  // Close HTTP server
  server.close(async () => {
    logger.info('HTTP server closed');

    // Cleanup resources
    await BrowserPool.shutdown();
    await closePool().catch(err => logger.error('Error closing DB', err));

    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
}

startServer();
