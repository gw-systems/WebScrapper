// Web Scraper Backend Server
// Refactored modular server entry point

const express = require('express');
const http = require('http');
const ws = require('ws');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config/environment');
const logger = require('./utils/logger');
const { setupWebSocket } = require('./websocket/connection');
const { testConnection, closePool } = require('./config/database');
const BrowserPool = require('./services/BrowserPool');

// Create App
const app = express();
const server = http.createServer(app);
const wss = new ws.Server({ server });

// Configuration
// CORS restrictive for prod, open for dev (based on config)
const corsOptions = {
  origin: config.isProduction ? config.frontendUrl : true,
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

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
app.use('/api/instamart', instamartRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv
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
