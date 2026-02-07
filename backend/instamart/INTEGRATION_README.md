# Instamart Integration - Setup Guide

## What Was Integrated

✅ **Python API Scraper** (standalone) - Fast, direct API calls to Instamart.
✅ **PostgreSQL Database** - Stores products with full metadata.
✅ **Node.js Import Scripts** - Bridge between Python JSON output and PostgreSQL.
✅ **API Endpoints** - REST API to list products, categories, and trigger scraping.
✅ **Hybrid Storage** - JSON files (backup) + Database (for fast queries).

---

## Architecture Comparison

| Feature | Existing UI Workflow | New Python Integration |
|---------|----------------------|------------------------|
| **Scraper** | Node.js (`apiScraper.js`) | Python (`api_scraper.py`) |
| **Trigger** | Web UI (WebSocket) | CLI / REST API |
| **Location** | Dynamic (via Puppeteer cookies) | Static (CONFIG in `config.py`) |
| **Output** | Excel File (Download) | PostgreSQL Database |
| **Persistence**| None (Ephemeral) | Permanent (Historical Data) |

> **Note:** The current Web UI triggers the Node.js scraper. The new Python scraper runs independently to build your product database.

---

## Quick Start (Python Integration)

### 1. Database Setup

The products table is required. Run the schema creation script:

```bash
cd backend
node create_schema_fixed.js
```

### 2. Import Scraped Data

Import existing JSON files into the database:

```bash
cd backend/scripts

# Import single file
node importInstamartProducts.js ../instamart/scraped_data/instamart/fresh_fruits.json
```

### 3. Scrape + Store (End-to-End)

Run the integrated workflow:

```bash
cd backend/scripts
node scrapeAndStoreInstamart.js "Dairy, Bread and Eggs"
```

---

## API Endpoints (`/api/instamart`)

The backend now exposes the following endpoints (powered by DB):

- `GET /products`: List products with filtering.
- `GET /categories`: List all categories.
- `POST /scrape`: Trigger new Python scrape.

---

## Troubleshooting

### "relation products does not exist"
Run `node backend/create_schema_fixed.js` to create the table.

### Python scraping errors
Check `backend/instamart/config.py` - make sure `COOKIE_STRING` is fresh.
