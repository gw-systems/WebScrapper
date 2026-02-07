"""
Debug scraper - saves raw API response to inspect the JSON structure
"""

from api_scraper import InstamartAPIScraper
import json

CATEGORY_NAME = "Dairy,Bread & Eggs"
TAXONOMY_TYPE = "Speciality taxonomy 1"

def main():
    scraper = InstamartAPIScraper()
    
    print(f"\n{'='*60}")
    print(f"DEBUG MODE: Fetching '{CATEGORY_NAME}'")
    print(f"{'='*60}\n")
    
    # Fetch raw response
    response = scraper.fetch_category_products(CATEGORY_NAME, TAXONOMY_TYPE)
    
    if response:
        # Save full response
        with open('debug_response.json', 'w', encoding='utf-8') as f:
            json.dump(response, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Response saved to: debug_response.json")
        print(f"   File size: {len(json.dumps(response))} bytes")
        
        # Quick analysis
        if 'data' in response:
            data = response['data']
            print(f"\n📊 Quick Analysis:")
            print(f"   - Top-level keys: {list(data.keys())}")
            
            if 'cards' in data:
                print(f"   - Number of cards: {len(data.get('cards', []))}")
                
                # Check first card structure
                if data.get('cards'):
                    first_card = data['cards'][0]
                    print(f"   - First card keys: {list(first_card.keys())}")
        
        # Try to parse products
        from product_parser import parse_products_from_response
        products = parse_products_from_response(response)
        
        print(f"\n🔍 Product Parser Result:")
        print(f"   - Products found: {len(products)}")
        
        if products:
            print(f"\n   Sample product fields:")
            sample = products[0]
            for key in list(sample.keys())[:10]:
                print(f"     - {key}: {sample[key]}")
        else:
            print(f"\n   ⚠️  No products found!")
            print(f"   This might mean:")
            print(f"     1. Category name is incorrect")
            print(f"     2. No products in this category")
            print(f"     3. Different JSON structure")
            print(f"\n   Check 'debug_response.json' to see the raw data")
    else:
        print(f"\n❌ Failed to fetch response")

if __name__ == "__main__":
    main()
