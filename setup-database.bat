@echo off
REM WebScrapper Database Setup Script for Windows
REM Run this script to set up the PostgreSQL database

set PSQL="C:\Program Files\PostgreSQL\18\bin\psql.exe"
set PGPASSWORD=password

echo.
echo ========================================
echo WebScrapper Database Setup
echo ========================================
echo.

REM Check if psql is available
if not exist %PSQL% (
    echo ERROR: PostgreSQL not found at %PSQL%
    echo Please update the PSQL path in this script.
    pause
    exit /b 1
)

echo Step 1: Creating database and user...
%PSQL% -U postgres -c "CREATE DATABASE webscrapper;" 2>nul
if errorlevel 1 (
    echo Database 'webscrapper' already exists or creation failed.
) else (
    echo Database 'webscrapper' created successfully!
)

%PSQL% -U postgres -c "CREATE USER webscrapper_user WITH ENCRYPTED PASSWORD 'dev_password_123';" 2>nul
if errorlevel 1 (
    echo User 'webscrapper_user' already exists or creation failed.
) else (
    echo User 'webscrapper_user' created successfully!
)

%PSQL% -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE webscrapper TO webscrapper_user;"
echo Privileges granted to webscrapper_user

echo.
echo Step 2: Running migrations...
%PSQL% -U postgres -d webscrapper -f "%~dp0database\migrations\001_initial_schema.sql"
if errorlevel 1 (
    echo ERROR: Migration failed!
    pause
    exit /b 1
)

echo.
echo Step 2.5: Fixing permissions...
%PSQL% -U postgres -d webscrapper -c "GRANT ALL ON SCHEMA public TO webscrapper_user;"
%PSQL% -U postgres -d webscrapper -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO webscrapper_user;"
%PSQL% -U postgres -d webscrapper -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO webscrapper_user;"
%PSQL% -U postgres -d webscrapper -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO webscrapper_user;"
%PSQL% -U postgres -d webscrapper -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO webscrapper_user;"
echo Permissions granted!

echo.
echo Step 3: Seeding development data...
%PSQL% -U postgres -d webscrapper -f "%~dp0database\seeds\dev_api_keys.sql"
if errorlevel 1 (
    echo ERROR: Seeding failed!
    pause
    exit /b 1
)

echo.
echo Step 4: Verifying setup...
%PSQL% -U postgres -d webscrapper -c "SELECT key, name FROM api_keys;"

echo.
echo ========================================
echo Database setup complete!
echo ========================================
echo.
echo Connection details:
echo   Host: localhost
echo   Port: 5432
echo   Database: webscrapper
echo   User: webscrapper_user
echo   Password: dev_password_123
echo.
echo Add to backend/.env:
echo DATABASE_URL=postgresql://webscrapper_user:dev_password_123@localhost:5432/webscrapper
echo.
echo Frontend API Key (add to frontend/.env.local):
echo VITE_API_KEY=dev-key-local-testing-only-12345678
echo.
pause
