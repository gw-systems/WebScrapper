-- Fix Database Permissions
-- Run this if you get permission errors

-- Connect to webscrapper database first
\c webscraper

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO webscraper_user;

-- Grant table permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO webscraper_user;

-- Grant sequence permissions (for auto-increment IDs)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO webscraper_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO webscraper_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO webscraper_user;

-- Verify permissions
\dp api_keys

SELECT 'Permissions fixed successfully!' as status;
