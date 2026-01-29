// Session Manager Service
// coordinates session state between in-memory and database

const Session = require('../models/Session');
const logger = require('../utils/logger');

class SessionManager {
    constructor() {
        this.localSessions = new Map(); // clientId -> { locSet: { svc: bool }, ... }
    }

    async createSession(clientId, apiKey, ipAddress, userAgent) {
        // initialize local state
        this.localSessions.set(clientId, {
            locSet: { blinkit: false, zepto: false, instamart: false },
            connectedAt: Date.now()
        });

        // persist to database
        try {
            await Session.create(clientId, apiKey, ipAddress, userAgent);
        } catch (err) {
            logger.error('Failed to persist session creation', { clientId, error: err.message });
            // proceed anyway, don't block connection if DB fails temporarily? 
            // strict: throw err; // soft: just log
            // For now, let's just log
        }
    }

    async closeSession(clientId) {
        this.localSessions.delete(clientId);
        try {
            await Session.terminate(clientId);
        } catch (err) {
            logger.error('Failed to terminate session in DB', { clientId, error: err.message });
        }
    }

    // Location State Management
    setLocationStatus(clientId, service, isSet) {
        if (this.localSessions.has(clientId)) {
            const session = this.localSessions.get(clientId);
            if (session.locSet) {
                session.locSet[service] = isSet;
            }
        }
    }

    getLocationStatus(clientId) {
        if (this.localSessions.has(clientId)) {
            return this.localSessions.get(clientId).locSet;
        }
        return { blinkit: false, zepto: false, instamart: false };
    }
}

module.exports = new SessionManager();
