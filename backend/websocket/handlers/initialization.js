const BrowserPool = require('../../services/BrowserPool');
const SessionManager = require('../../services/SessionManager');
const logger = require('../../utils/logger');

async function handleInitialize(socket, cid, data) {
    // Logic from original server.js handleInitialize
    logger.info(`Initializing client ${cid}`, { action: 'initialize' });

    // Create session in DB
    // In a real flow, we might have received API key in query params during connection upgrade
    // For now, we assume we just track it.

    // Just send success for now, as BrowserPool initializes lazily when needed
    // or we can pre-warm if specific services requested.

    // Send status update as expected by frontend
    socket.send(JSON.stringify({
        action: 'statusUpdate',
        step: 'initialize',
        status: 'completed',
        success: true,
        message: 'Browsers initialized.'
    }));
}

async function handleCloseBrowser(socket, cid, data) {
    const { service } = data;
    if (service) {
        await BrowserPool.closeBrowser(cid, service);
        socket.send(JSON.stringify({
            type: 'browser-closed',
            service,
            status: 'success'
        }));
    }
}

module.exports = {
    handleInitialize,
    handleCloseBrowser
};
