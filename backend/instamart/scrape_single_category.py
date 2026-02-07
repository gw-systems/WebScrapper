"""
Scrape a single category from Instamart
"""

from api_scraper import InstamartAPIScraper

# ============================================================================
# CONFIGURE YOUR CATEGORY HERE
# ============================================================================

CATEGORY_NAME = "Dairy"
TAXONOMY_TYPE = "Speciality taxonomy 1"  # Usually this, but can vary

# ============================================================================

def main():
    print(f"\n{'='*60}")
    print(f"Scraping single category: {CATEGORY_NAME}")
    print(f"{'='*60}\n")
    
    # Create scraper
    scraper = InstamartAPIScraper()
    
    # Scrape the category
    products = scraper.scrape_category(CATEGORY_NAME, TAXONOMY_TYPE)
    
    # Save if we got products
    if products:
        scraper.save_products(products, CATEGORY_NAME)
        print(f"\n✅ Success! Scraped {len(products)} products from '{CATEGORY_NAME}'")
    else:
        print(f"\n❌ Failed to scrape '{CATEGORY_NAME}'")
        print("Possible reasons:")
        print("  - Cookies expired (update COOKIE_STRING in config.py)")
        print("  - Category name incorrect")
        print("  - No products in this category")

if __name__ == "__main__":
    main()
