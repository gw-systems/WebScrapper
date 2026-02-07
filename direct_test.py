from backend.instamart.api_scraper import InstamartAPIScraper
import sys
import os

# Add project root to path to allow imports
sys.path.append(os.getcwd())

def test_manual_cookies():
    print("Starting Direct API Test with Manual Cookies...")
    
    # Initialize scraper without arguments to force using config.py
    scraper = InstamartAPIScraper()
    
    # Verify cookies
    print(f"Cookie String Length: {len(scraper.cookie_string)}")
    print(f"Cookie Preview: {scraper.cookie_string[:50]}...")
    
    # Scrape 'Fresh Fruits'
    print("\nScraping 'Fresh Fruits'...")
    products = scraper.scrape_category("Fresh Fruits")
    
    if products:
        print(f"\nSUCCESS! Found {len(products)} products.")
    else:
        print("\nFAILURE! No products found.")

if __name__ == "__main__":
    test_manual_cookies()
