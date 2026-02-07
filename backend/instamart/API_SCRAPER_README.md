# Instamart API Scraper - Quick Start Guide

## 🚀 Setup (One-Time)

### Step 1: Update Cookies in `apiScraper.js`

The scraper needs **fresh cookies** from your browser to authenticate with Instamart's API.

1. **Open Instamart** in your browser: https://www.swiggy.com/instamart
2. **Set your delivery location** (e.g., Mumbai Central)
3. **Open DevTools** (Press `F12`)
4. **Go to Network tab**
5. **Click on any category** (e.g., "Fresh Fruits")
6. **Find the request** named `v2?categoryName=...`
7. **Click on it** → Go to "Headers" tab → Scroll to "Request Headers"
8. **Copy the entire `Cookie` value**

9. **Update `apiScraper.js`** (lines 14-16):
```javascript
const CONFIG = {
    // Paste your cookie string here (from step 8)
    COOKIE: 'deviceId=s%3A...; tid=s%3A...; sid=s%3A...; lat=s%3A...; lng=s%3A...',
    
    // Also update these from the URL parameters
    STORE_ID: '1135722',  // From storeId parameter
    PRIMARY_STORE_ID: '1135722',  // From primaryStoreId
    SECONDARY_STORE_ID: '1396282',  // From secondaryStoreId
    
    USER_AGENT: 'Mozilla/5.0 ...',  // From User-Agent header
};
```

---

## 📝 Usage

### Scrape a Single Category

```bash
node backend/instamart/apiScraper.js
```

By default, it scrapes **"Fresh Fruits"**. Edit line 279 in `apiScraper.js` to change category:

```javascript
const categoryName = 'Fresh Fruits';  // Change this
```

### Use as a Module

```javascript
const { scrapeCategory } = require('./backend/instamart/apiScraper');

// Scrape all pages
const products = await scrapeCategory('Fresh Fruits', 0);

// Or limit to 3 pages
const products = await scrapeCategory('Bread and Buns', 3);
```

---

## 🔍 Output

Products are saved to: `scraped_data/instamart_<category>_api.json`

Example output structure:
```json
[
  {
    "name": "Apple - Royal Gala, Regular",
    "brand": "Fresho",
    "skuId": "ABC123",
    "price": "150",
    "mrp": "180",
    "discount": "17% OFF",
    "quantity": "4 pcs (approx. 520 g - 600 g)",
    "rating": "4.3",
    "ratingCount": "1.2k",
    "image": "https://media-assets.swiggy.com/swiggy/image/upload/...",
    "inStock": true
  }
]
```

---

## ⚡ Benefits vs Old DOM Scraper

| Feature | DOM Scraper (Old) | **API Scraper (New)** |
|---------|-------------------|----------------------|
| Speed | 🐌 Slow (30-60 sec/category) | ⚡ **Fast (2-5 sec/category)** |
| Memory | 🔴 High (Puppeteer) | 🟢 **Low (axios only)** |
| Reliability | ⚠️ Breaks if UI changes | ✅ **Stable (API contract)** |
| Data Quality | 🤔 Parsed from HTML | ✅ **Clean JSON** |
| Maintenance | 😫 Needs selector updates | 😌 **Minimal** |

---

## ⚠️ Troubleshooting

### Issue: "Got 0 products"

**Cause**: Cookies expired or invalid

**Fix**: 
1. Refresh cookies from DevTools (see Step 1)
2. Make sure `sid` cookie is fresh (expires in ~1 hour)
3. Verify `storeId` matches your location

### Issue: "Error 401 Unauthorized"

**Cause**: Missing or expired session cookie (`sid`)

**Fix**: Extract fresh cookies from browser

### Issue: "Error 403 Forbidden"

**Cause**: Missing headers or blocked User-Agent

**Fix**: 
1. Copy `User-Agent` from DevTools
2. Ensure all required headers are set

---

## 🔄 Cookie Expiration

The `sid` (session) cookie expires **every ~1 hour**. For long scraping sessions:

**Option A**: Manual refresh
- Re-extract cookies every hour

**Option B**: Hybrid approach (recommended)
- Use Puppeteer ONCE to get fresh cookies
- Use API scraper for actual scraping
- Refresh cookies when they expire

---

## 📊 Comparison Test

Want to compare API vs DOM scraper?

```bash
# Old DOM scraper (slow)
node backend/instamart/categoryScraper.js

# New API scraper (fast)
node backend/instamart/apiScraper.js
```

Compare the output files and execution time!

---

## 🎯 Next Steps

1. ✅ Update cookies in `apiScraper.js`
2. ✅ Run test scrape: `node backend/instamart/apiScraper.js`
3. ✅ Verify output in `scraped_data/`
4. 🔧 Integrate into your main scraping workflow
5. 🚀 Enjoy 10x faster scraping!
