# Instamart API Reference - Scraping Guide

## API Endpoint (ACTUAL - From DevTools)

**Base URL** (Correct V2 Endpoint):
```
https://www.swiggy.com/api/instamart/category-listing/v2
```

**Query Parameters**:
- `categoryName` - e.g., "Fresh Fruits" (URL encoded)
- `taxonomyType` - "Speciality taxonomy 1" (URL encoded)
- `offset` - Pagination offset (starts at 0)
- `storeId` - Primary store ID (e.g., "1135722") **REQUIRED**
- `primaryStoreId` - Same as storeId (e.g., "1135722")
- `secondaryStoreId` - Backup store (e.g., "1396282")

**Full Example URL**:
```
https://www.swiggy.com/api/instamart/category-listing/v2?categoryName=Fresh%20Fruits&taxonomyType=Speciality%20taxonomy%201&offset=0&storeId=1135722&primaryStoreId=1135722&secondaryStoreId=1396282
```

---

## Authentication & Required Headers

### Critical Headers
These headers are **REQUIRED** for the API to work:

```http
GET /api/instamart/category-listing/v2?... HTTP/1.1
Host: www.swiggy.com
User-Agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36
Accept: */*
Accept-Encoding: gzip, deflate, br, zstd
Accept-Language: en-US,en;q=0.9
Content-Type: application/json
Referer: https://www.swiggy.com/instamart/category-listing?categoryName=Fresh%20Fruits&storeId=1135722&offset=0&filterName=&taxonomyType=Speciality%20taxonomy%201&showAgeConsent=false
Cookie: deviceId=s%3A...; tid=s%3A...; sid=s%3A...; lat=s%3A18.9690247...; lng=s%3A72.8205292...; address=s%3A...; [... many more cookies]
```

### Essential Cookies (Must Have)

| Cookie | Purpose | Example |
|--------|---------|----------|
| `deviceId` | Device identifier | `s%3Afeb4ad36-...` |
| `tid` | User tracking ID | `s%3A2e7b7973-...` |
| `sid` | **Session ID** (expires ~1 hour) | `s%3Apjob6f6b-...` |
| `lat` | **User latitude** | `s%3A18.9690247...` |
| `lng` | **User longitude** | `s%3A72.8205292...` |
| `address` | User address | `s%3AMumbai%20Central...` |
| `_guest_tid` | Guest tracking | `2deb4a9c-6e1f-4c15-...` |
| `_device_id` | Device ID | `916bb7a0-6537-...` |
| `userLocation` | JSON location data | `{"address":"Mumbai Central",...}` |

### Cookie Expiration Notes
⚠️ **Important**: 
- `sid` expires in **~1 hour** (session cookie)
- `deviceId`, `tid` expire in **30 days**
- Location cookies (`lat`, `lng`) set when user chooses delivery location
- **Must refresh cookies regularly** for long-running scrapers

---

## Response Structure

### Top Level
```json
{
  "data": {
    "statusMessage": "",
    "pageOffset": null,
    "cards": [...]
  }
}
```

### Finding Products

Products are nested deep inside:
```
data.cards[].card.card.gridElements.infoWithStyle.items[]
```

---

## Product Data Structure

### Main Product Object
```json
{
  "displayName": "Product Name",
  "brand": "Brand Name",
  "inStock": true,
  "isAvail": true,
  "variations": [...],  // Array of SKU variations
  "badges": [...],
  "productId": "UNIQUE_ID",
  "parentProductId": "PARENT_ID"
}
```

### Variation Object (SKU Level)
```json
{
  "skuId": "CNLLRLL9A4",
  "spinId": "TH29MFQX25",
  "quantityDescription": "330 g",
  "displayName": "Full Product Name",
  "brandName": "Brand",
  "listingVariant": true,  // true if this is the main listing variation
  
  "price": {
    "mrp": {
      "units": "159",
      "nanos": 0
    },
    "offerPrice": {
      "units": "138", 
      "nanos": 0
    },
    "unitLevelPrice": "54.1/100 g",
    "offerApplied": {
      "listingDescription": "13% OFF"
    }
  },
  
  "imageIds": ["image1.jpg", "image2.jpg", ...],
  
  "rating": {
    "value": "4.2",
    "count": "2.4k"
  },
  
  "category": "Bread and Buns",
  "subCategoryType": "Sourdough Bread",
  "superCategory": "Dairy, Bread and Eggs",
  
  "inventory": {
    "inStock": true
  },
  
  "shortDescription": "Product tagline",
  "weightInGrams": 330
}
```

---

## Key Fields for Scraping

### Essential Fields
| Field Path | Description | Example |
|------------|-------------|---------|
| `displayName` | Product name | "Baker's Dozen Sourdough" |
| `brand` | Brand name | "The Baker's Dozen" |
| `variations[0].skuId` | SKU identifier | "CNLLRLL9A4" |
| `variations[0].quantityDescription` | Package size | "330 g" |
| `variations[0].price.offerPrice.units` | Current price | "138" |
| `variations[0].price.mrp.units` | Original price | "159" |
| `variations[0].imageIds[0]` | Primary image | "image.jpg" |
| `variations[0].rating.value` | Rating | "4.2" |
| `variations[0].rating.count` | Review count | "2.4k" |
| `inStock` | Availability | true/false |

### Image URL Construction
Images are referenced by ID. Full URL pattern:
```
https://media-assets.swiggy.com/swiggy/image/upload/{imageId}
```

Example:
```
https://media-assets.swiggy.com/swiggy/image/upload/NI_CATALOG/IMAGES/CIW/2025/10/19/1e78619b-3e4d-4157-9bbf-450d80594935_1.Composite.jpg
```

---

## Filter/Facet System

### Available Filters
The API response includes filter options for:
- **Gourmet** - Premium products
- **Handpicked** - Curated selection
- **Type** - Product types (Breads, Buns, etc.)
- **Brand** - Brand filters
- **Rating** - Customer ratings (3+, 4+, 4.5+)
- **Pack Size** - Size filters

### Filter Structure
```json
{
  "label": "Type",
  "id": "type",
  "facetInfo": [
    {
      "label": "Breads",
      "id": "Breads",
      "selected": false
    }
  ]
}
```

---

## Pagination

Products are paginated using:
- `offset` - Main offset parameter
- `itemsOffset` - Items offset

Response includes:
- `resultCount` - Total products available (e.g., 116)

To get all products, increment offset by ~20-50 until no more products return.

---

## Important Notes

1. **Location Critical**: `storeId` in URL params determines warehouse/inventory
2. **Cookies Required**: `lat`, `lng`, `sid` cookies are MANDATORY
3. **StoreId Discovery**: Found in URL params (`storeId`, `primaryStoreId`, `secondaryStoreId`)
4. **Listing Variant**: `listingVariant: true` indicates the main SKU to display
5. **Multiple Variations**: One product can have multiple size variations
6. **Ad Products**: Some items have `"type": "BADGE_TYPE_AD"` badge
7. **Price Format**: Prices are in rupees, split as `units` (₹) and `nanos` (paise)
8. **Session Expiry**: `sid` cookie expires in ~1 hour, must refresh

---

## Scraping Strategy

### Recommended: Direct API Calls (No Browser!)

**Step-by-Step**:

1. **One-Time Setup: Extract Headers from Browser**
   - Open DevTools → Network tab
   - Navigate to any Instamart category
   - Find `category-listing/v2` request
   - Copy all cookies from the Cookie header
   - Copy User-Agent, Referer headers

2. **Build Request with axios/fetch**
   ```javascript
   const response = await axios.get(
     'https://www.swiggy.com/api/instamart/category-listing/v2',
     {
       params: {
         categoryName: 'Fresh Fruits',
         taxonomyType: 'Speciality taxonomy 1',
         offset: 0,
         storeId: '1135722',
         primaryStoreId: '1135722',
         secondaryStoreId: '1396282'
       },
       headers: {
         'User-Agent': 'Mozilla/5.0...',
         'Cookie': 'deviceId=...; sid=...; lat=...; lng=...',
         'Referer': 'https://www.swiggy.com/instamart/category-listing',
         'Accept': '*/*'
       }
     }
   );
   ```

3. **Parse JSON Response** (no DOM!)
   ```javascript
   const products = response.data.data.cards
     .find(c => c.card?.card?.gridElements)
     ?.card.card.gridElements.infoWithStyle.items || [];
   ```

4. **Handle Pagination**
   - Increment `offset` by 20-50 until no products return
   - Check `resultCount` to know total available

5. **Cookie Refresh Strategy** (choose one):
   - **Option A**: Manual refresh daily (copy new cookies from DevTools)
   - **Option B**: Use Puppeteer to auto-extract cookies, then use for API calls
   - **Option C**: Hybrid - Puppeteer gets cookies once, API does the scraping

### Benefits vs DOM Scraping
- ✅ **10x faster** (no browser rendering)
- ✅ Clean structured JSON (no HTML parsing)
- ✅ No lazy loading issues
- ✅ No scroll/wait logic needed
- ✅ Easy error handling
- ✅ Much lower memory usage

### Challenges
- ⚠️ Need valid cookies (must extract from browser)
- ⚠️ Session expires (~1 hour), need refresh mechanism
- ⚠️ Must maintain proper headers (User-Agent, Referer)
- ⚠️ StoreId varies by location (must extract dynamically)
