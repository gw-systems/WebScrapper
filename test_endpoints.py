import requests
import json
import sys

output = open('endpoint_validation.txt', 'w', encoding='utf-8')
sys.stdout = output

COOKIE_STRING = '__SW=dEQ-6lrSDsElfzAM0xysFl98BG4lSZkt; _device_id=fe983fce-0fca-4cbd-8cd0-2431da279535; _gcl_au=1.1.1894882929.1769065141; fontsLoaded=1; _ga=GA1.1.70300472.1769065144; deviceId=s%3Afe983fce-0fca-4cbd-8cd0-2431da279535.pgR%2BBMHiamWcdG2ofP0kzJ%2BFnxFGhEn33isogQnVux8; versionCode=1200; platform=web; statusBarHeight=0; bottomOffset=0; genieTrackOn=false; isNative=false; openIMHP=false; _fbp=fb.1.1769853494109.605092661902406423; moe_uuid=f60502a6-c4bd-4c9f-9e49-dc566d20577a; _ga_34JYJ0BCRN=GS2.1.s1770284467$o3$g0$t1770284471$j56$l0$h0; _ga_YE38MFJRBZ=GS2.1.s1770284467$o3$g1$t1770284512$j15$l0$h0; lat=s%3A12.960059122809971.h096G6jFEvdKvA%2FcX99%2BU8AUppIjzSJe1T91Va8STTA; lng=s%3A77.57337538383284.wugDnemZ%2FtGrNMd6ngGjUURS0PQobZYKKuJR5ywS5qU; address=s%3A.4Wx2Am9WLolnmzVcU32g6YaFDw0QbIBFRj2nkO7P25s; addressId=s%3A.4Wx2Am9WLolnmzVcU32g6YaFDw0QbIBFRj2nkO7P25s; userLocation=%7B%22address%22%3A%22%22%2C%22lat%22%3A12.960059122809971%2C%22lng%22%3A77.57337538383284%2C%22id%22%3A%22%22%2C%22annotation%22%3A%22%22%2C%22name%22%3A%22%22%7D; tid=s%3A3d4ce6f2-a562-43fc-956b-9527c5c9383b.XWJhL5NnNPBOoXXfUy44PRyFUynQY3mFYD9uye9RG1U; sid=s%3Apka70a98-73a6-40da-a1a0-de0ec3cefcef.uIIU9neZIy8us6sYKxKDhBC3Qs8itD%2F039whPZxqdic; subplatform=mweb; ally-on=false; strId=; LocSrc=s%3AswgyUL.Dzm1rLPIhJmB3Tl2Xs6141hVZS0ofGP7LGmLXgQOA7Y; isImBottomBarXpEnabled=s%3Atrue.e48T%2B1OIqhnOplwfDLfBpm6ciWJemq9CxKQOhhXd4VA; webBottomBarHeight=64; _ga_0XZC5MS97H=GS2.1.s1770441093$o9$g1$t1770441106$j47$l0$h0; _ga_VEG1HFE5VZ=GS2.1.s1770441092$o9$g1$t1770441106$j46$l0$h0; _ga_8N8XRG907L=GS2.1.s1770441092$o9$g1$t1770441106$j46$l0$h0; aws-waf-token=41bd496b-e21c-4573-8fa5-d679ed99941e:BQoAeLckQW0OAAAA:6i9mKoSpgpPVJHF9IdVNhnCfBgmiz9iO/AdKfNTPy4pwhkt0bLC4Wufrm/bjfAunH7dD2Qc392PiggJZY8dvhXrLoTCfk/gvaln6H6S2wLsdvva3TUDrsfkOs0zDBNtobvEuWk2e3QdJrf/b0LTUogQjwDmn2QqCiCfnLUHusRz2HT1pQYaPMaQ/T1/deGvDQmH9w1Sx+i/1HHo1x346UzkZTDZhaQ46S3LYOyQXbW9Djkhv5nTy'

STORE_ID = "1402948"

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Cookie': COOKIE_STRING
}

print("="*80)
print("TESTING DISCOVERED API ENDPOINTS")
print("="*80)

# Test 1: Search API v2 (POST)
print("\n" + "="*80)
print("1. SEARCH API (POST /api/instamart/search/v2)")
print("="*80)

search_url = f"https://www.swiggy.com/api/instamart/search/v2?offset=0&ageConsent=false&voiceSearchTrackingId=&storeId={STORE_ID}&primaryStoreId={STORE_ID}&secondaryStoreId="

search_payload = {
    "facets": [],
    "sortAttribute": "",
    "query": "bread",
    "search_results_offset": "0",
    "page_type": "INSTAMART_AUTO_SUGGEST_PAGE",
    "is_pre_search_tag": False
}

try:
    response = requests.post(search_url, headers=headers, json=search_payload)
    print(f"\nStatus: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ SUCCESS!")
        print(f"Top-level keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
        
        with open('search_response.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("Saved to: search_response.json")
    else:
        print(f"❌ FAILED: {response.status_code}")
        print(f"Response: {response.text[:500]}")
except Exception as e:
    print(f"❌ Exception: {e}")

# Test 2: Search Suggestions API (GET)
print("\n" + "="*80)
print("2. SEARCH SUGGESTIONS API (GET /api/instamart/search/suggest-items/v2)")
print("="*80)

suggest_url = f"https://www.swiggy.com/api/instamart/search/suggest-items/v2?query=bread&storeId={STORE_ID}&primaryStoreId={STORE_ID}&secondaryStoreId=&trackingId=test"

try:
    response = requests.get(suggest_url, headers=headers)
    print(f"\nStatus: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ SUCCESS!")
        print(f"Top-level keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
        
        with open('suggestions_response.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("Saved to: suggestions_response.json")
    else:
        print(f"❌ FAILED: {response.status_code}")
        print(f"Response: {response.text[:500]}")
except Exception as e:
    print(f"❌ Exception: {e}")

# Test 3: Home Page API (GET)
print("\n" + "="*80)
print("3. HOME PAGE API (GET /api/instamart/home/v2)")
print("="*80)

home_url = f"https://www.swiggy.com/api/instamart/home/v2?offset=0&storeId={STORE_ID}&clientId=INSTAMART-APP"

try:
    response = requests.get(home_url, headers=headers)
    print(f"\nStatus: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ SUCCESS!")
        print(f"Top-level keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
        
        with open('home_response.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("Saved to: home_response.json")
    else:
        print(f"❌ FAILED: {response.status_code}")
        print(f"Response: {response.text[:500]}")
except Exception as e:
    print(f"❌ Exception: {e}")

print("\n" + "="*80)
print("TESTING COMPLETE")
print("="*80)

output.close()
sys.stdout = sys.__stdout__
print("Endpoint validation complete! Check endpoint_validation.txt")
