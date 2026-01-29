// ScrapingJob Model
// Tracks scraping operations for audit trail and analytics

const { query } = require('../config/database');
const logger = require('../utils/logger');

class ScrapingJob {
    /**
     * Create a new scraping job
     * @param {string} sessionId - Session ID
     * @param {string} service - Service name ('zepto', 'blinkit', 'instamart')
     * @param {string} jobType - Job type ('search', 'category')
     * @param {string} searchTerm - Search term or category name
     * @param {string} location - Location
     * @returns {Promise<Object>} - Created job object
     */
    static async create(sessionId, service, jobType, searchTerm = null, location = null) {
        try {
            const result = await query(
                `INSERT INTO scraping_jobs (session_id, service, job_type, search_term, location, status)
         VALUES ($1, $2, $3, $4, $5, 'started')
         RETURNING *`,
                [sessionId, service, jobType, searchTerm, location]
            );

            logger.info('Scraping job created', {
                id: result.rows[0].id,
                sessionId,
                service,
                jobType
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating scraping job', {
                error: error.message,
                sessionId,
                service,
                jobType
            });
            throw error;
        }
    }

    /**
     * Update job status
     * @param {number} jobId - Job ID
     * @param {string} status - New status ('in_progress', 'completed', 'failed')
     * @param {number} productsFound - Number of products found
     * @param {string} errorMessage - Error message if failed
     * @returns {Promise<boolean>} - True if updated successfully
     */
    static async updateStatus(jobId, status, productsFound = null, errorMessage = null) {
        try {
            const updates = ['status = $2'];
            const params = [jobId, status];
            let paramIndex = 3;

            if (productsFound !== null) {
                updates.push(`products_found = $${paramIndex}`);
                params.push(productsFound);
                paramIndex++;
            }

            if (errorMessage !== null) {
                updates.push(`error_message = $${paramIndex}`);
                params.push(errorMessage);
                paramIndex++;
            }

            if (status === 'completed' || status === 'failed') {
                updates.push('completed_at = CURRENT_TIMESTAMP');
            }

            const result = await query(
                `UPDATE scraping_jobs
         SET ${updates.join(', ')}
         WHERE id = $1
         RETURNING id`,
                params
            );

            if (result.rows.length > 0) {
                logger.info('Scraping job status updated', {
                    id: jobId,
                    status,
                    productsFound
                });
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error updating scraping job status', {
                error: error.message,
                jobId,
                status
            });
            return false;
        }
    }

    /**
     * Get job history for a session
     * @param {string} sessionId - Session ID
     * @param {number} limit - Maximum number of jobs to return
     * @returns {Promise<Array>} - Array of job objects
     */
    static async getHistory(sessionId, limit = 50) {
        try {
            const result = await query(
                `SELECT * FROM scraping_jobs
         WHERE session_id = $1
         ORDER BY started_at DESC
         LIMIT $2`,
                [sessionId, limit]
            );

            return result.rows;
        } catch (error) {
            logger.error('Error getting job history', {
                error: error.message,
                sessionId
            });
            return [];
        }
    }

    /**
     * Get statistics for a service
     * @param {string} service - Service name
     * @param {Date} dateFrom - Start date
     * @param {Date} dateTo - End date
     * @returns {Promise<Object>} - Statistics object
     */
    static async getStats(service, dateFrom = null, dateTo = null) {
        try {
            let dateFilter = '';
            const params = [service];

            if (dateFrom) {
                dateFilter += ' AND started_at >= $2';
                params.push(dateFrom);
            }

            if (dateTo) {
                dateFilter += ` AND started_at <= $${params.length + 1}`;
                params.push(dateTo);
            }

            const result = await query(
                `SELECT
           COUNT(*) as total_jobs,
           COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
           COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
           SUM(products_found) as total_products,
           AVG(products_found) as avg_products_per_job,
           AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
         FROM scraping_jobs
         WHERE service = $1 ${dateFilter}`,
                params
            );

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting scraping stats', {
                error: error.message,
                service
            });
            return null;
        }
    }

    /**
     * Get recent failed jobs
     * @param {number} limit - Maximum number of jobs to return
     * @returns {Promise<Array>} - Array of failed job objects
     */
    static async getRecentFailures(limit = 10) {
        try {
            const result = await query(
                `SELECT * FROM scraping_jobs
         WHERE status = 'failed'
         ORDER BY started_at DESC
         LIMIT $1`,
                [limit]
            );

            return result.rows;
        } catch (error) {
            logger.error('Error getting recent failures', { error: error.message });
            return [];
        }
    }
}

module.exports = ScrapingJob;
