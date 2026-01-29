-- Fix Database Permissions
-- Run this if you get permission errors

-- Connect to webscrapper database first
\c webscrapper

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO webscrapper_user;

-- Grant table permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO webscrapper_user;

-- Grant sequence permissions (for auto-increment IDs)
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO webscrapper_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO webscrapper_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO webscrapper_user;

-- Verify permissions
\dp api_keys

SELECT 'Permissions fixed successfully!' as status;
