import json
import sys

output = open('product_analysis.txt', 'w', encoding='utf-8')
sys.stdout = output

print("="*80)
print("EXTRACTING PRODUCT DATA FROM NAVIGATION TABS")
print("="*80)

# Load the response
with open('instamart_category_response.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Navigate to the navigationTabs
nav_card = data['data']['cards'][0]['card']['card']
tabs = nav_card['navigationTabs']

print(f"\nFound {len(tabs)} navigation tabs")
print(f"\nTab names:")
for idx, tab in enumerate(tabs):
    tab_name = tab.get('name', 'Unknown')
    num_cards = len(tab.get('cards', []))
    print(f"  {idx}. {tab_name} - {num_cards} cards")

# Focus on the first tab (Fresh Fruits)
print("\n" + "="*80)
print("ANALYZING FIRST TAB: Fresh Fruits")
print("="*80)

first_tab = tabs[0]
tab_cards = first_tab.get('cards', [])

print(f"\nTotal cards in first tab: {len(tab_cards)}")

# Analyze each card type
print("\nCard types:")
for idx, card in enumerate(tab_cards):
    card_type = card.get('@type', 'Unknown')
    print(f"  {idx}. {card_type}")

# Look for item/grid cards
print("\n" + "="*80)
print("SEARCHING FOR PRODUCT ITEMS")
print("="*80)

all_products = []

for idx, card in enumerate(tab_cards):
    card_type = card.get('@type', '')
    
    if 'Grid' in card_type or 'Item' in card_type:
        print(f"\n✅ Found product card at index {idx}")
        print(f"   Type: {card_type}")
        print(f"   Keys: {list(card.keys())}")
        
        # Check for data/items
        if 'data' in card:
            print(f"   Has 'data' key")
            card_data = card['data']
            if isinstance(card_data, dict):
                print(f"   data keys: {list(card_data.keys())}")
                
                # Look for products in various places
                for key in ['items', 'products', 'variations', 'data']:
                    if key in card_data and isinstance(card_data[key], list):
                        items = card_data[key]
                        print(f"   Found {len(items)} items in '{key}'")
                        all_products.extend(items)
        
        # Check for layout
        if 'layout' in card:
            print(f"   Has 'layout' key")
        
        # Check for variations
        if 'variations' in card:
            variations = card['variations']
            print(f"   Has {len(variations)} variations")
            all_products.extend(variations)

# If still no products, do deep search
if not all_products:
    print("\n⚠️  No products found in obvious places, searching deeply...")
    
    def extract_all_dict_with_keys(obj, required_keys, depth=0, max_depth=10):
        """Extract all dicts that have the required keys"""
        if depth > max_depth:
            return []
        
        results = []
        
        if isinstance(obj, dict):
            # Check if this dict has all required keys
            if all(key in obj for key in required_keys):
                results.append(obj)
            
            # Recurse into values
            for value in obj.values():
                results.extend(extract_all_dict_with_keys(value, required_keys, depth + 1, max_depth))
        
        elif isinstance(obj, list):
            for item in obj:
                results.extend(extract_all_dict_with_keys(item, required_keys, depth + 1, max_depth))
        
        return results
    
    # Look for objects with product-like fields
    print("\n   Searching for objects with displayName + price...")
    potential_products = extract_all_dict_with_keys(first_tab, ['displayName', 'price'])
    
    if potential_products:
        print(f"   ✅ Found {len(potential_products)} potential products!")
        all_products = potential_products
    else:
        print("\n   Searching for objects with id + name...")
        potential_products = extract_all_dict_with_keys(first_tab, ['id', 'name'])
        if potential_products:
            print(f"   ✅ Found {len(potential_products)} items with id + name")
            all_products = potential_products

# Analyze products if found
if all_products:
    print("\n" + "="*80)
    print(f"📦 FOUND {len(all_products)} PRODUCTS!")
    print("="*80)
    
    # Analyze first product
    first_product = all_products[0]
    print(f"\nFirst product structure:")
    print(f"Type: {type(first_product)}")
    
    if isinstance(first_product, dict):
        print(f"\nAll keys in first product:")
        for key in sorted(first_product.keys()):
            value = first_product[key]
            value_type = type(value).__name__
            
            if isinstance(value, (list, dict)):
                length = len(value)
                print(f"  - {key}: {value_type} ({length} items)")
            elif isinstance(value, str) and len(value) < 100:
                print(f"  - {key}: {value_type} = '{value}'")
            else:
                print(f"  - {key}: {value_type}")
    
    # Save first product
    with open('sample_product.json', 'w', encoding='utf-8') as f:
        json.dump(first_product, f, indent=2, ensure_ascii=False)
    print(f"\n✅ Saved first product to sample_product.json")
    
    # Save all products
    with open('all_products.json', 'w', encoding='utf-8') as f:
        json.dump(all_products, f, indent=2, ensure_ascii=False)
    print(f"✅ Saved all {len(all_products)} products to all_products.json")
    
    # Extract key fields from a few products
    print("\n" + "="*80)
    print("SAMPLE PRODUCT DATA")
    print("="*80)
    
    for idx in range(min(3, len(all_products))):
        product = all_products[idx]
        print(f"\nProduct {idx + 1}:")
        if isinstance(product, dict):
            # Try to extract key info
            for key in ['displayName', 'name', 'display_name', 'title']:
                if key in product:
                    print(f"  Name: {product[key]}")
                    break
            
            for key in ['price', 'selling_price', 'mrp']:
                if key in product:
                    print(f"  Price: {product[key]}")
                    break
            
            for key in ['id', 'product_id', 'sku']:
                if key in product:
                    print(f"  ID: {product[key]}")
                    break

else:
    print("\n❌ No products found!")
    print("   The data structure might be different than expected.")
    print("   Saving first tab for manual inspection...")
    
    with open('first_tab_structure.json', 'w', encoding='utf-8') as f:
        json.dump(first_tab, f, indent=2, ensure_ascii=False)
    print("   ✅ Saved to first_tab_structure.json")

print("\n" + "="*80)
print("✅ EXTRACTION COMPLETE")
print("="*80)

output.close()
sys.stdout = sys.__stdout__
print("Product extraction complete! Check product_analysis.txt")
