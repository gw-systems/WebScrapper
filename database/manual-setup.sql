-- Run this in pgAdmin Query Tool or any PostgreSQL client
-- Connect to PostgreSQL first, then execute these commands

-- 1. Create database (if not exists)
SELECT 'CREATE DATABASE webscraper'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'webscraper')\gexec

-- 2. Switch to webscraper database and run the following:

-- Create user (if not exists)
DO
$$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'webscraper_user') THEN
    CREATE USER webscraper_user WITH ENCRYPTED PASSWORD 'dev_password_123';
  END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE webscraper TO webscraper_user;

-- Now run the schema creation from migrations/001_initial_schema.sql
-- Copy and paste the contents of that file here, or use:
-- File > Open > database/migrations/001_initial_schema.sql

-- Then run seeds from seeds/dev_api_keys.sql

-- Verify setup
SELECT key, name FROM api_keys;
