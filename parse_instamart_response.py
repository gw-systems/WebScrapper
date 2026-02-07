import json
from collections import defaultdict
import sys

# Redirect to file
output = open('parse_output.txt', 'w', encoding='utf-8')
sys.stdout = output

print("="*80)
print("PARSING INSTAMART CATEGORY RESPONSE")
print("="*80)

# Load the response
with open('instamart_category_response.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("\n📊 TOP-LEVEL STRUCTURE")
print("="*80)
print(f"Response type: {type(data)}")
print(f"\nTop-level keys: {list(data.keys())}")

# Analyze data structure
if 'data' in data:
    data_section = data['data']
    print(f"\n📦 'data' section keys ({len(data_section)} keys):")
    for key in data_section.keys():
        value = data_section[key]
        value_type = type(value).__name__
        if isinstance(value, list):
            print(f"  - {key}: {value_type} ({len(value)} items)")
        elif isinstance(value, dict):
            print(f"  - {key}: {value_type} ({len(value)} keys)")
        else:
            print(f"  - {key}: {value_type}")

# Analyze cards structure (most likely contains products)
print("\n" + "="*80)
print("🎴 ANALYZING CARDS")
print("="*80)

if 'data' in data and 'cards' in data['data']:
    cards = data['data']['cards']
    print(f"\nTotal cards: {len(cards)}")
    
    # Analyze card types
    card_types = defaultdict(int)
    for card in cards:
        if 'card' in card:
            inner = card['card']
            if 'card' in inner:
                card_data = inner['card']
                card_type = card_data.get('@type', 'unknown')
                card_types[card_type] += 1
    
    print(f"\nCard types found:")
    for card_type, count in sorted(card_types.items()):
        print(f"  - {card_type}: {count}")
    
    # Look for product data
    print("\n" + "="*80)
    print("🔍 SEARCHING FOR PRODUCT DATA")
    print("="*80)
    
    products_found = []
    
    for idx, card in enumerate(cards):
        try:
            if 'card' in card and 'card' in card['card']:
                card_data = card['card']['card']
                card_type = card_data.get('@type', '')
                
                # Print info about each card
                print(f"\nCard {idx}:")
                print(f"  Type: {card_type}")
                
                # Look for grid/product widgets
                if 'Grid' in card_type or 'Item' in card_type or 'Product' in card_type or 'navigation' in card_type.lower():
                    print(f"  ⭐ INTERESTING - Keys: {list(card_data.keys())}")
                    
                    # Try to extract product info
                    if 'data' in card_data:
                        print(f"     Has 'data' key!")
                    if 'items' in card_data:
                        print(f"     Has 'items' key with {len(card_data['items'])} items")
                        products_found.append((idx, card_data['items']))
                    if 'variations' in card_data:
                        print(f"     Has 'variations' key")
                    if 'navigationTabs' in card_data:
                        tabs = card_data['navigationTabs']
                        print(f"     Has {len(tabs)} navigation tabs")
                        # Check if tabs have cards
                        if tabs and 'cards' in tabs[0]:
                            print(f"     First tab has {len(tabs[0]['cards'])} cards!")
                
        except Exception as e:
            print(f"  Error: {e}")
            continue
    
    # If we found products, analyze them
    if products_found:
        print("\n" + "="*80)
        print("📦 PRODUCT DATA ANALYSIS")
        print("="*80)
        print(f"\nFound {len(products_found)} card(s) with items")
        
        for card_idx, product_list in products_found:
            print(f"\nCard {card_idx} has {len(product_list)} items")
            if product_list:
                first_product = product_list[0]
                print(f"  First item type: {type(first_product)}")
                if isinstance(first_product, dict):
                    print(f"  First item keys: {list(first_product.keys())}")
        
        # Save first product
        if products_found[0][1]:
            first_product = products_found[0][1][0]
            with open('sample_product.json', 'w', encoding='utf-8') as f:
                json.dump(first_product, f, indent=2, ensure_ascii=False)
            print(f"\n✅ Saved first product to sample_product.json")

print("\n" + "="*80)
print("✅ ANALYSIS COMPLETE")
print("="*80)

output.close()
sys.stdout = sys.__stdout__
print("Analysis complete! Check parse_output.txt")
