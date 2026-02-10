# Database Setup Guide

## Option 1: Docker (Recommended for Development)

The easiest way to get PostgreSQL running locally:

```powershell
# Start PostgreSQL with Docker Compose
docker-compose up -d postgres

# Check if it's running
docker ps

# Access PostgreSQL shell
docker exec -it webscraper-postgres psql -U webscraper_user -d webscraper
```

The Docker setup automatically:
- Creates the database and user
- Runs migrations
- Seeds development data
- Persists data in `./postgres-data/` directory

## Option 2: Local PostgreSQL Installation

### Install PostgreSQL

**Using Chocolatey** (you have this installed):
```powershell
choco install postgresql14 --params '/Password:postgres'
```

**Or Download Installer**:
Download from https://www.postgresql.org/download/windows/

### Setup Database

```powershell
# Create database and user
psql -U postgres

postgres=# CREATE DATABASE webscraper;
postgres=# CREATE USER webscraper_user WITH ENCRYPTED PASSWORD 'dev_password_123';
postgres=# GRANT ALL PRIVILEGES ON DATABASE webscraper TO webscraper_user;
postgres=# \q

# Run migrations
psql -U webscraper_user -d webscraper -f database/migrations/001_initial_schema.sql

# Seed development data
psql -U webscraper_user -d webscraper -f database/seeds/dev_api_keys.sql

# Verify setup
psql -U webscraper_user -d webscraper -c "SELECT * FROM api_keys;"
```

## Database Configuration

Create `backend/.env` file:

```env
# PostgreSQL Configuration
DATABASE_URL=postgresql://webscraper_user:dev_password_123@localhost:5432/webscraper
DB_HOST=localhost
DB_PORT=5432
DB_NAME=webscraper
DB_USER=webscraper_user
DB_PASSWORD=dev_password_123
DB_POOL_MIN=2
DB_POOL_MAX=10
```

## Database Schema

### Tables

- **api_keys**: Authentication keys for WebSocket connections
- **sessions**: Active and historical WebSocket sessions
- **scraping_jobs**: Audit trail of all scraping operations
- **rate_limits**: Rate limiting tracking per IP

### Maintenance Functions

```sql
-- Cleanup old sessions (should run periodically)
SELECT cleanup_old_sessions();

-- Cleanup old rate limit records
SELECT cleanup_old_rate_limits();
```

## Migrations

Migrations are located in `database/migrations/` and should be run in order.

To create a new migration:
1. Create `00X_description.sql` in `database/migrations/`
2. Include both UP and DOWN migration logic
3. Test on development database first

## Troubleshooting

### Connection Issues

```powershell
# Check if PostgreSQL is running
# Docker:
docker ps | findstr postgres

# Windows Service:
Get-Service postgresql*
```

### Reset Database

```powershell
# Docker:
docker-compose down -v
docker-compose up -d postgres

# Local:
dropdb -U postgres webscrapper
createdb -U postgres webscrapper
# Re-run migrations
```

### View Logs

```powershell
# Docker:
docker logs webscraper-postgres

# Local:
# Check logs in PostgreSQL data directory
```
