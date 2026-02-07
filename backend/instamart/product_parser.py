"""
Product Parser for Instamart API
Extracts and formats product data from API responses
"""

def parse_product(product_dict):
    """
    Parse a single product dictionary into a clean format
    
    Args:
        product_dict (dict): Raw product data from API
        
    Returns:
        dict: Formatted product data
    """
    try:
        # Extract price information
        price_info = extract_price_info(product_dict.get('price', {}))
        
        # Extract media URLs
        images = extract_media_urls(product_dict.get('medias', []))
        
        # Build clean product object
        product = {
            # Identifiers
            'sku_id': product_dict.get('skuId', ''),
            'spin_id': product_dict.get('spinId', ''),
            
            # Basic info
            'name': product_dict.get('displayName', ''),
            'brand': product_dict.get('brandName', ''),
            'category': product_dict.get('category', ''),
            'super_category': product_dict.get('superCategory', ''),
            'sub_category': product_dict.get('subCategoryType', ''),
            
            # Pricing
            'mrp': price_info['mrp'],
            'offer_price': price_info['offer_price'],
            'discount': price_info['discount'],
            'discount_percent': price_info['discount_percent'],
            'unit_price': price_info['unit_price'],
            
            # Quantity & Stock
            'quantity': product_dict.get('quantityDescription', ''),
            'weight': product_dict.get('secondaryQuantityDescription', ''),
            'in_stock': product_dict.get('inventory', {}).get('inStock', False),
            'max_quantity': product_dict.get('cartAllowedQuantity', {}).get('allowedQuantity', 0),
            
            # Images & Media
            'images': images,
            'primary_image': images[0] if images else '',
            
            # Description
            'description': product_dict.get('shortDescription', ''),
            
            # Additional metadata
            'pod_id': product_dict.get('podId', ''),
            'weight_grams': product_dict.get('weightInGrams', 0),
            'is_listing_variant': product_dict.get('listingVariant', False),
        }
        
        return product
        
    except Exception as e:
        print(f"Error parsing product: {e}")
        return None


def extract_price_info(price_obj):
    """
    Extract price details from price object
    
    Args:
        price_obj (dict): Price object from API
        
    Returns:
        dict: Formatted price information
    """
    try:
        mrp = int(price_obj.get('mrp', {}).get('units', 0))
        offer_price = int(price_obj.get('offerPrice', {}).get('units', 0))
        discount = int(price_obj.get('discountValue', {}).get('units', 0))
        
        # Calculate discount percentage
        discount_percent = 0
        if mrp > 0:
            discount_percent = round((discount / mrp) * 100, 1)
        
        return {
            'mrp': mrp,
            'offer_price': offer_price,
            'discount': discount,
            'discount_percent': discount_percent,
            'unit_price': price_obj.get('unitLevelPrice', ''),
        }
    except Exception as e:
        return {
            'mrp': 0,
            'offer_price': 0,
            'discount': 0,
            'discount_percent': 0,
            'unit_price': '',
        }


def extract_media_urls(media_list):
    """
    Extract image URLs from media list
    
    Args:
        media_list (list): List of media objects
        
    Returns:
        list: List of image URLs
    """
    base_url = "https://instamart-media-assets.swiggy.com/swiggy/image/upload/"
    
    images = []
    for media in media_list:
        if media.get('type') == 'MEDIA_TYPE_IMAGE':
            image_id = media.get('id', '')
            if image_id:
                images.append(f"{base_url}{image_id}")
    
    return images


def deep_search_products(json_response):
    """
    Deep search to find all products in nested JSON structure
    Based on discovered data structure: navigationTabs[0].cards
    
    Args:
        json_response (dict): Full API response
        
    Returns:
        list: List of product dictionaries
    """
    products = []
    
    try:
        # Navigate to the expected structure
        data = json_response.get('data', {})
        cards = data.get('cards', [])
        
        if not cards:
            return []
        
        # Get navigation card
        nav_card = cards[0].get('card', {}).get('card', {})
        navigation_tabs = nav_card.get('navigationTabs', [])
        
        if not navigation_tabs:
            return []
        
        # Get first tab (the one with products)
        first_tab = navigation_tabs[0]
        
        # Search for products in the tab's cards
        def find_products_recursive(obj, depth=0, max_depth=10):
            """Recursively search for product objects"""
            if depth > max_depth:
                return
            
            if isinstance(obj, dict):
                # Check if this looks like a product
                if 'displayName' in obj and 'price' in obj and 'skuId' in obj:
                    products.append(obj)
                
                # Recurse into values
                for value in obj.values():
                    find_products_recursive(value, depth + 1, max_depth)
            
            elif isinstance(obj, list):
                for item in obj:
                    find_products_recursive(item, depth + 1, max_depth)
        
        find_products_recursive(first_tab)
        
    except Exception as e:
        print(f"Error in deep search: {e}")
    
    return products


def parse_products_from_response(json_response):
    """
    Main function to extract and parse all products from API response
    
    Args:
        json_response (dict): Full API response
        
    Returns:
        list: List of formatted product dictionaries
    """
    # Find all raw products
    raw_products = deep_search_products(json_response)
    
    # Parse each product
    parsed_products = []
    for raw_product in raw_products:
        parsed = parse_product(raw_product)
        if parsed:
            parsed_products.append(parsed)
    
    return parsed_products
