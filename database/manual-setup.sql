-- Run this in pgAdmin Query Tool or any PostgreSQL client
-- Connect to PostgreSQL first, then execute these commands

-- 1. Create database (if not exists)
SELECT 'CREATE DATABASE webscrapper'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'webscrapper')\gexec

-- 2. Switch to webscrapper database and run the following:

-- Create user (if not exists)
DO
$$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'webscrapper_user') THEN
    CREATE USER webscrapper_user WITH ENCRYPTED PASSWORD 'dev_password_123';
  END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE webscrapper TO webscrapper_user;

-- Now run the schema creation from migrations/001_initial_schema.sql
-- Copy and paste the contents of that file here, or use:
-- File > Open > database/migrations/001_initial_schema.sql

-- Then run seeds from seeds/dev_api_keys.sql

-- Verify setup
SELECT key, name FROM api_keys;
