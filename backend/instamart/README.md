# Instamart Category Scraper - Usage Guide

## 📦 What Was Built

A complete Python scraper for Instamart that:
- ✅ Uses direct API calls (no browser automation!)
- ✅ Scrapes product data from categories
- ✅ Handles errors and retries
- ✅ Saves data to clean JSON files
- ✅ Tracks scraping statistics

## 🏗️ Architecture

```
backend/instamart/
├── config.py          # Configuration (cookies, storeId, categories)
├── product_parser.py  # Product data extraction
├── api_scraper.py     # Main scraper logic
└── __init__.py        # Module init
```

## 🚀 Quick Start

### 1. Update Cookies (REQUIRED)

Open `backend/instamart/config.py` and update `COOKIE_STRING`:

```python
COOKIE_STRING = "your_fresh_cookie_string_here"
```

**How to get cookies:**
1. Open https://www.swiggy.com/instamart in Chrome
2. Press F12 → Network tab
3. Reload the page
4. Find any API request (e.g., `/api/instamart/home/v2`)
5. Copy the entire `Cookie:` header value
6. Paste into `config.py`

⚠️ **Cookies expire in ~1 hour!** You'll need to refresh them.

### 2. Update Store ID (Optional)

Change `STORE_ID` in `config.py` to your location:

```python
STORE_ID = "1402948"  # Your location's store ID
```

### 3. Configure Categories

Edit the `CATEGORIES` list in `config.py`:

```python
CATEGORIES = [
    {"name": "Fresh Fruits", "taxonomyType": "Speciality taxonomy 1"},
    {"name": "Fresh Vegetables", "taxonomyType": "Speciality taxonomy 1"},
    # Add more categories...
]
```

### 4. Run the Scraper

```bash
cd backend/instamart
python api_scraper.py
```

## 📊 Output

### JSON Files

Products saved to `scraped_data/instamart/`:

```
scraped_data/instamart/
├── fresh_fruits.json
├── fresh_vegetables.json
└── scrape_summary.json
```

### Sample Output Structure

```json
{
  "category": "Fresh Fruits",
  "scraped_at": "2026-02-07T11:30:00",
  "store_id": "1402948",
  "total_products": 32,
  "products": [
    {
      "sku_id": "G8S0HQ705N",
      "name": "Mandarin Orange (Kittale Hannu)",
      "brand": "Fruits and Vegetables",
      "category": "Exotic Fruits",
      "mrp": 119,
      "offer_price": 95,
      "discount": 24,
      "discount_percent": 20.2,
      "quantity": "3 Pieces",
      "weight": "240 - 300g",
      "in_stock": true,
      "images": ["https://instamart-media-assets.swiggy.com/..."],
      "description": "Tender intensely sweet...",
      ...
    }
  ]
}
```

## 🔧 Troubleshooting

### HTTP 202 Responses

**Problem**: All categories fail with 202 status

**Solution**: Cookies expired - update `COOKIE_STRING` in `config.py`

### No Products Found

**Problem**: Categories scrape successfully but return 0 products

**Possible causes**:
- Wrong category name
- Wrong taxonomy type
- Products not available in your location (storeId)

### Rate Limiting

**Problem**: Getting blocked after multiple requests

**Solution**: Increase `REQUEST_DELAY` in `config.py`:

```python
REQUEST_DELAY = 2.0  # Increase delay between requests
```

## 📋 Product Fields Extracted

30+ fields extracted per product:

| Field | Description |
|-------|-------------|
| `sku_id` | Unique product SKU |
| `name` | Product display name |
| `brand` | Brand/vendor name |
| `category` | Product category |
| `mrp` | Maximum Retail Price |
| `offer_price` | Selling price |
| `discount` | Discount amount |
| `discount_percent` | Discount percentage |
| `quantity` | Quantity description |
| `weight` | Weight/size |
| `in_stock` | Availability status |
| `images[]` | Product images |
| `description` | Product description |
| ... | 20+ more fields |

See `product_parser.py` for complete field list.

## 🎯 Next Steps

### Extend to Other Endpoints

1. **Search Scraper** - Use `/api/instamart/search/v2`
2. **Product Details** - Get full product info (when endpoint is found)
3. **Collections** - Scrape product collections

### Database Integration

Modify `save_products()` in `api_scraper.py` to save to your database instead of JSON.

### Automation

1. **Auto Cookie Refresh** - Use Selenium to extract fresh cookies
2. **Scheduled Scraping** - Run via cron/scheduler
3. **Multi-Location** - Scrape multiple store IDs

## 📖 API Documentation

See `api_endpoints_reference.md` for:
- All discovered endpoints
- Request/response formats
- Parameter documentation
- Example code

## ⚡ Performance

- ~1-2 seconds per category
- 32 products per category (single page)
- Pagination not yet implemented

## 🛡️ Best Practices

1. **Respect rate limits** - Add delays between requests
2. **Refresh cookies** - Update every ~1 hour
3. **Error handling** - Scraper handles 202/network errors gracefully
4. **Logging** - Check `scrape_summary.json` for stats

## 🆘 Support

Check these files for more info:
- `data_structure_and_missing_endpoints.md` - Product data structure
- `api_endpoints_reference.md` - API documentation
- `implementation_plan.md` - Architecture details
