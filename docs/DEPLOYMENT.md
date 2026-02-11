# Production Deployment Guide

## Quick Start

### Option 1: Interactive Setup (Recommended)

Run the automated setup script to generate all necessary production configuration:

```bash
node scripts/setup-production.js
```

This will:
- Ask for your deployment domain
- Generate cryptographically secure secrets
- Create `.env.production` with all required variables
- Create `frontend/.env.production` with WebSocket URLs
- Display credentials for database, Grafana, and pgAdmin

### Option 2: Manual Setup

1. **Generate secrets:**
   ```bash
   node backend/scripts/generate-secrets.js
   ```

2. **Copy template:**
   ```bash
   cp .env.production .env
   ```

3. **Edit `.env`** and replace:
   - `API_KEY_SECRET` - 64-char hex from generate-secrets.js
   - `JWT_SECRET` - 64-char hex from generate-secrets.js
   - `DB_PASSWORD` - Strong password (16+ chars)
   - `your-domain.com` - Your actual deployment domain
   - Grafana/pgAdmin passwords

4. **Edit `frontend/.env.production`:**
   - Replace `your-domain.com` with actual domain
   - Use `wss://` for HTTPS sites
   - Use `ws://` only for HTTP/development

## Docker Deployment

### Build and Deploy

**Single container (root Dockerfile):**
```bash
docker build \
  --build-arg VITE_WS_URL=wss://your-domain.com \
  --build-arg FRONTEND_URL=https://your-domain.com \
  -t webscraper:latest .

docker run -p 10000:10000 \
  --env-file .env.production \
  webscraper:latest
```

**Multi-container (docker-compose):**
```bash
# Ensure .env exists with production values
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Resource Requirements

For 2-3 concurrent users:

| Service | CPU Limit | Memory Limit | Reserved |
|---------|-----------|--------------|----------|
| Backend | 1 core | 1GB | 512MB |
| Frontend | 0.5 core | 256MB | 128MB |
| PostgreSQL | 1 core | 512MB | 256MB |
| Prometheus | 0.5 core | 256MB | 128MB |
| Grafana | 0.5 core | 256MB | 128MB |
| **Total** | **3.5 cores** | **~2.25GB** | **~1.14GB** |

**Recommended server:** 4 vCPUs, 4GB RAM, 20GB storage

## Environment Variables Reference

### Critical Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `API_KEY_SECRET` | API authentication secret | 64-char hex |
| `JWT_SECRET` | JWT signing secret | 64-char hex |
| `DB_PASSWORD` | Database password | Strong password |
| `FRONTEND_URL` | Frontend domain | `https://your-domain.com` |
| `VITE_WS_URL` | WebSocket URL (frontend) | `wss://your-domain.com` |

### Browser Pool Settings

For 2-3 users, current defaults are optimal:
- `MAX_BROWSERS_TOTAL=10` - Total browser instances
- `MAX_BROWSERS_PER_USER=2` - Per-user limit
- `SCRAPING_TIMEOUT_MS=300000` - 5 minutes
- `SEARCH_TIMEOUT_MS=120000` - 2 minutes

## Deployment Platforms

### Render

1. Connect GitHub repository
2. Select "Docker" as deployment method
3. Set environment variables in Render dashboard
4. Deploy

### Railway

1. Create new project from GitHub
2. Configure Docker deployment
3. Add environment variables
4. Deploy

### DigitalOcean App Platform

1. Create new app from GitHub
2. Select Dockerfile
3. Configure environment variables
4. Deploy

### AWS/GCP/Azure

Use container services (ECS, Cloud Run, Container Apps) with the provided Dockerfile.

## Security Checklist

Before deploying:

- [ ] Generated new secrets (not dev defaults)
- [ ] Set strong DB password (16+ chars)
- [ ] Updated `FRONTEND_URL` to actual domain
- [ ] Updated `VITE_WS_URL` to actual domain
- [ ] Enabled HTTPS/TLS certificates
- [ ] Verified `.env` files not in Git
- [ ] Set `NODE_ENV=production`
- [ ] Changed Grafana admin password
- [ ] Changed pgAdmin admin password
- [ ] Reviewed CORS origin settings

## Accessing Services

After deployment:

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| Frontend | `https://your-domain.com` | - |
| Backend API | `https://your-domain.com/api` | API key required |
| Grafana | `http://localhost:3001` | From `.env` |
| Prometheus | `http://localhost:9090` | - |
| pgAdmin | `http://localhost:5050` | From `.env` |

## Monitoring

**Health checks:**
- Backend: `GET /api/health`
- Frontend: `GET /health`

**Metrics:**
- Prometheus: `GET /metrics`

**Logs:**
```bash
# Docker compose
docker-compose logs -f [service-name]

# Single container
docker logs -f [container-id]
```

## Troubleshooting

**Database connection fails:**
- Verify `DB_HOST` matches service name in docker-compose
- Check database is healthy: `docker ps`
- Verify credentials match

**Frontend can't connect to backend:**
- Check `VITE_WS_URL` matches deployed domain
- Verify uses `wss://` for HTTPS
- Rebuild frontend after environment changes

**Out of memory:**
- Reduce `MAX_BROWSERS_TOTAL` to 5-6
- Increase server RAM
- Monitor with Grafana dashboard

**High CPU usage:**
- Check number of active scraping sessions
- Review browser cleanup logs
- Reduce concurrent users limit

## Backup & Recovery

**Database backup:**
```bash
# Export
docker exec webscraper-db pg_dump -U webscraper_user webscraper > backup.sql

# Restore
docker exec -i webscraper-db psql -U webscraper_user webscraper < backup.sql
```

**Full backup:**
```bash
docker-compose down
tar -czf backup.tar.gz postgres-data/ logs/
docker-compose up -d
```
