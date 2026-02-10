-- WebScraper Database Schema
-- PostgreSQL 14+

-- API Keys table for authentication
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  usage_count INTEGER DEFAULT 0
);

-- Sessions table (tracks active WebSocket sessions)
CREATE TABLE sessions (
  id VARCHAR(36) PRIMARY KEY,
  api_key_id INTEGER REFERENCES api_keys(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Scraping jobs table (history/audit trail)
CREATE TABLE scraping_jobs (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(36) REFERENCES sessions(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL CHECK (service IN ('zepto', 'blinkit', 'instamart')),
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('search', 'category')),
  search_term VARCHAR(255),
  location VARCHAR(255),
  status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'failed')),
  products_found INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Rate limiting table
CREATE TABLE rate_limits (
  id SERIAL PRIMARY KEY,
  ip_address INET NOT NULL,
  endpoint VARCHAR(100) NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ip_address, endpoint, window_start)
);

-- Indexes for performance
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX idx_sessions_active ON sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_sessions_connected ON sessions(connected_at DESC);
CREATE INDEX idx_scraping_jobs_session ON scraping_jobs(session_id);
CREATE INDEX idx_scraping_jobs_service ON scraping_jobs(service, started_at DESC);
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status, started_at DESC);
CREATE INDEX idx_rate_limits_lookup ON rate_limits(ip_address, endpoint, window_start);

-- Create function to cleanup old sessions (runs periodically)
CREATE OR REPLACE FUNCTION cleanup_old_sessions() RETURNS void AS $$
BEGIN
  UPDATE sessions 
  SET is_active = false, disconnected_at = CURRENT_TIMESTAMP
  WHERE is_active = true 
    AND connected_at < NOW() - INTERVAL '1 hour'
    AND disconnected_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old rate limit records
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits() RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits 
  WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE api_keys IS 'Stores API keys for WebSocket authentication';
COMMENT ON TABLE sessions IS 'Tracks active and historical WebSocket sessions';
COMMENT ON TABLE scraping_jobs IS 'Audit trail of all scraping operations';
COMMENT ON TABLE rate_limits IS 'Tracks rate limiting per IP and endpoint';

COMMENT ON COLUMN api_keys.key IS 'Unique API key string (hashed in production)';
COMMENT ON COLUMN sessions.id IS 'Client ID from WebSocket connection';
COMMENT ON COLUMN scraping_jobs.session_id IS 'References the session that initiated this job';
COMMENT ON COLUMN rate_limits.window_start IS 'Start of the rate limit time window';
