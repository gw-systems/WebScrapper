from curl_cffi import requests

import json
import time
import os
import argparse
import sys
from datetime import datetime
from pathlib import Path

# Import local modules using relative imports
try:
    from . import config
    from .product_parser import parse_products_from_response
except ImportError:
    # Fallback for direct execution
    import config
    from product_parser import parse_products_from_response


class InstamartAPIScraper:
    """Main scraper class for Instamart API"""
    
    def __init__(self, cookie_string=None, store_id=None, user_agent=None):
        """
        Initialize the scraper
        
        Args:
            cookie_string (str): Cookie string from browser (optional, uses config if not provided)
            store_id (str): Store ID for location (optional, uses config if not provided)
            user_agent (str): User-Agent string from browser
        """
        self.cookie_string = cookie_string or config.COOKIE_STRING
        self.store_id = store_id or config.STORE_ID
        self.user_agent = user_agent
        
        # Setup headers
        self.headers = config.HEADERS.copy()
        # Remove default UA from config headers
        if 'User-Agent' in self.headers:
            del self.headers['User-Agent']

        if self.cookie_string:
            self.headers['Cookie'] = self.cookie_string
            # pass
        if self.user_agent:
            self.headers['User-Agent'] = self.user_agent
        
        # Setup curl_cffi Session
        self.session = requests.Session(impersonate="chrome124")

        # Stats tracking
        self.stats = {
            'categories_scraped': 0,
            'total_products': 0,
            'failed_categories': 0,
            'errors': []
        }
    
    def fetch_category_products(self, category_name, taxonomy_type="Speciality taxonomy 1", offset=0):
        """
        Fetch products for a specific category
        
        Args:
            category_name (str): Category name (e.g., "Fresh Fruits")
            taxonomy_type (str): Taxonomy type
            offset (int): Pagination offset
            
        Returns:
            dict: API response or None if failed
        """
        url = config.ENDPOINTS['category_listing']
        
        params = {
            'categoryName': category_name,
            'taxonomyType': taxonomy_type,
            'offset': offset,
            'storeId': self.store_id,
            'primaryStoreId': self.store_id,
            'secondaryStoreId': ''
        }
        
        print(f"\nFetching: {category_name} (offset: {offset})", flush=True)
        
        for attempt in range(config.MAX_RETRIES):
            try:
                # Use curl_cffi session
                response = self.session.get(
                    url, 
                    headers=self.headers, 
                    params=params, 
                    timeout=30
                )
                
                print(f"   Status: {response.status_code}", flush=True)
                
                if response.status_code == 200:
                    return response.json()
                
                elif response.status_code == 202:
                    print(f"   202 Response - Cookie might be expired!", flush=True)
                    print(f"   Response Headers: {response.headers}", flush=True)
                    
                    # Write response to file
                    with open("error_202.html", "wb") as f:
                        f.write(response.content)
                    print(f"   Response saved to error_202.html", flush=True)
                    
                    self.stats['errors'].append({
                        'category': category_name,
                        'error': 'HTTP 202 - Cookies might be expired'
                    })
                    return None
                
                else:
                    print(f"   Failed: {response.status_code}", flush=True)
                    if attempt < config.MAX_RETRIES - 1:
                        print(f"   Retrying in {config.RETRY_DELAY} seconds...")
                        time.sleep(config.RETRY_DELAY)
                    
            except Exception as e:
                print(f"   Request error: {e}")
                if attempt < config.MAX_RETRIES - 1:
                    print(f"   Retrying in {config.RETRY_DELAY} seconds...")
                    time.sleep(config.RETRY_DELAY)
        
        # All retries failed
        self.stats['errors'].append({
            'category': category_name,
            'error': 'All retries failed'
        })
        return None
    
    def scrape_category(self, category_name, taxonomy_type="Speciality taxonomy 1"):
        """
        Scrape all products from a category
        
        Args:
            category_name (str): Category name
            taxonomy_type (str): Taxonomy type
            
        Returns:
            list: List of parsed products
        """
        print(f"\n{'='*60}", flush=True)
        print(f"Scraping Category: {category_name}", flush=True)
        print(f"{'='*60}", flush=True)
        
        # Fetch category data
        response = self.fetch_category_products(category_name, taxonomy_type)
        
        if not response:
            print(f"Failed to fetch category: {category_name}")
            self.stats['failed_categories'] += 1
            return []
        
        # Parse products
        products = parse_products_from_response(response)
        
        print(f"Found {len(products)} products")
        
        # Update stats
        self.stats['categories_scraped'] += 1
        self.stats['total_products'] += len(products)
        
        # Add delay to avoid rate limiting
        time.sleep(config.REQUEST_DELAY)
        
        return products
    
    def save_products(self, products, category_name):
        """
        Save products to JSON file
        
        Args:
            products (list): List of product dictionaries
            category_name (str): Category name for filename
        """
        # Create output directory
        output_dir = Path(config.OUTPUT_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filename
        filename = category_name.lower().replace(' ', '_').replace('&', 'and')
        filepath = output_dir / f"{filename}.json"
        
        # Prepare output data
        output = {
            'category': category_name,
            'scraped_at': datetime.now().isoformat(),
            'store_id': self.store_id,
            'total_products': len(products),
            'products': products
        }
        
        # Save to file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Saved to: {filepath}")
        return str(filepath)
    
    def scrape_all_categories(self, categories=None):
        """
        Scrape all configured categories
        
        Args:
            categories (list): List of category dicts (optional, uses config if not provided)
        """
        categories = categories or config.CATEGORIES
        
        print(f"\n{'='*60}", flush=True)
        print(f"ARTING INSTAMART CATEGORY SCRAPER", flush=True)
        print(f"{'='*60}", flush=True)
        print(f"Store ID: {self.store_id}")
        print(f"Categories to scrape: {len(categories)}")
        print(f"{'='*60}")
        
        start_time = time.time()
        
        for category in categories:
            category_name = category['name']
            taxonomy_type = category.get('taxonomyType', 'Speciality taxonomy 1')
            
            # Scrape category
            products = self.scrape_category(category_name, taxonomy_type)
            
            # Save if we got products
            if products:
                self.save_products(products, category_name)
        
        # Save summary
        self.save_summary(start_time)
        
        # Print final stats
        self.print_stats()
    
    def save_summary(self, start_time):
        """Save scraping summary"""
        output_dir = Path(config.OUTPUT_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        duration = time.time() - start_time
        
        summary = {
            'scraped_at': datetime.now().isoformat(),
            'duration_seconds': round(duration, 2),
            'store_id': self.store_id,
            'stats': self.stats
        }
        
        filepath = output_dir / 'scrape_summary.json'
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        print(f"\nSummary saved to: {filepath}")
    
    def print_stats(self):
        """Print scraping statistics"""
        print(f"\n{'='*60}")
        print(f"SCRAPING COMPLETE")
        print(f"{'='*60}")
        print(f"Categories scraped: {self.stats['categories_scraped']}")
        print(f"Total products: {self.stats['total_products']}")
        print(f"Failed categories: {self.stats['failed_categories']}")
        
        if self.stats['errors']:
            print(f"\nErrors encountered:")
            for error in self.stats['errors']:
                print(f"   - {error['category']}: {error['error']}")
        
        print(f"{'='*60}\n")


def main():
    """Main entry point with CLI argument support"""
    # Force UTF-8 stdout for Windows (Node.js communication)
    # Force UTF-8 stdout for Windows (Node.js communication)
    # Force UTF-8 stdout for Windows (Node.js communication)
    if sys.platform == 'win32':
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')

    # DEBUG: Redirect stdout/stderr to file
    # sys.stdout = open('python_debug.log', 'w', encoding='utf-8')
    # sys.stderr = sys.stdout

    parser = argparse.ArgumentParser(description='Instamart API Scraper')
    parser.add_argument('--category', type=str, help='Specific category name to scrape')
    parser.add_argument('--cookie', type=str, help='Cookie string (overrides config)')
    parser.add_argument('--store', type=str, help='Store ID (overrides config)')
    parser.add_argument('--user-agent', type=str, help='User-Agent string from browser')
    
    args = parser.parse_args()
    
    # Initialize scraper with CLI args or config defaults
    scraper = InstamartAPIScraper(
        cookie_string=args.cookie,
        store_id=args.store,
        user_agent=args.user_agent
    )
    
    if args.category:
        # Single category mode (called by Node.js backend)
        products = scraper.scrape_category(args.category)
        if products:
            filepath = scraper.save_products(products, args.category)
            # Print JSON-formatted result to stdout for easy parsing by Node.js
            # Use specific marker that Node.js can robustly find
            print(f"__JSON_RESULT__:{filepath}", flush=True)
        else:
            print("No products found", flush=True)
            sys.exit(1)
            
    else:
        # Default mode: Scrape all configured categories
        scraper.scrape_all_categories()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Emergency logging for crashes
        with open("python_crash.log", "w") as f:
            import traceback
            traceback.print_exc(file=f)
        sys.exit(1)
