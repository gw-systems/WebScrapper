import requests
import json
import sys

# Your fresh cookies
COOKIE_STRING = '__SW=dEQ-6lrSDsElfzAM0xysFl98BG4lSZkt; _device_id=fe983fce-0fca-4cbd-8cd0-2431da279535; _gcl_au=1.1.1894882929.1769065141; fontsLoaded=1; _ga=GA1.1.70300472.1769065144; deviceId=s%3Afe983fce-0fca-4cbd-8cd0-2431da279535.pgR%2BBMHiamWcdG2ofP0kzJ%2BFnxFGhEn33isogQnVux8; versionCode=1200; platform=web; statusBarHeight=0; bottomOffset=0; genieTrackOn=false; isNative=false; openIMHP=false; _fbp=fb.1.1769853494109.605092661902406423; moe_uuid=f60502a6-c4bd-4c9f-9e49-dc566d20577a; _ga_34JYJ0BCRN=GS2.1.s1770284467$o3$g0$t1770284471$j56$l0$h0; _ga_YE38MFJRBZ=GS2.1.s1770284467$o3$g1$t1770284512$j15$l0$h0; lat=s%3A12.960059122809971.h096G6jFEvdKvA%2FcX99%2BU8AUppIjzSJe1T91Va8STTA; lng=s%3A77.57337538383284.wugDnemZ%2FtGrNMd6ngGjUURS0PQobZYKKuJR5ywS5qU; address=s%3A.4Wx2Am9WLolnmzVcU32g6YaFDw0QbIBFRj2nkO7P25s; addressId=s%3A.4Wx2Am9WLolnmzVcU32g6YaFDw0QbIBFRj2nkO7P25s; userLocation=%7B%22address%22%3A%22%22%2C%22lat%22%3A12.960059122809971%2C%22lng%22%3A77.57337538383284%2C%22id%22%3A%22%22%2C%22annotation%22%3A%22%22%2C%22name%22%3A%22%22%7D; tid=s%3A3d4ce6f2-a562-43fc-956b-9527c5c9383b.XWJhL5NnNPBOoXXfUy44PRyFUynQY3mFYD9uye9RG1U; sid=s%3Apka70a98-73a6-40da-a1a0-de0ec3cefcef.uIIU9neZIy8us6sYKxKDhBC3Qs8itD%2F039whPZxqdic; subplatform=mweb; ally-on=false; strId=; LocSrc=s%3AswgyUL.Dzm1rLPIhJmB3Tl2Xs6141hVZS0ofGP7LGmLXgQOA7Y; isImBottomBarXpEnabled=s%3Atrue.e48T%2B1OIqhnOplwfDLfBpm6ciWJemq9CxKQOhhXd4VA; webBottomBarHeight=64; _ga_0XZC5MS97H=GS2.1.s1770441093$o9$g1$t1770441106$j47$l0$h0; _ga_VEG1HFE5VZ=GS2.1.s1770441092$o9$g1$t1770441106$j46$l0$h0; _ga_8N8XRG907L=GS2.1.s1770441092$o9$g1$t1770441106$j46$l0$h0; aws-waf-token=41bd496b-e21c-4573-8fa5-d679ed99941e:BQoAeLckQW0OAAAA:6i9mKoSpgpPVJHF9IdVNhnCfBgmiz9iO/AdKfNTPy4pwhkt0bLC4Wufrm/bjfAunH7dD2Qc392PiggJZY8dvhXrLoTCfk/gvaln6H6S2wLsdvva3TUDrsfkOs0zDBNtobvEuWk2e3QdJrf/b0LTUogQjwDmn2QqCiCfnLUHusRz2HT1pQYaPMaQ/T1/deGvDQmH9w1Sx+i/1HHo1x346UzkZTDZhaQ46S3LYOyQXbW9Djkhv5nTy'

# Your store ID 
STORE_ID = "1402948"

# Test KNOWN working endpoint from your Instamart_Devtools_finding file
# API: /api/instamart/category-listing/v2
url = f"https://www.swiggy.com/api/instamart/category-listing/v2?categoryName=Fresh%20Fruits&taxonomyType=Speciality%20taxonomy%201&offset=0&storeId={STORE_ID}&primaryStoreId={STORE_ID}&secondaryStoreId="

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Cookie': COOKIE_STRING
}

output_file = open('api_test_output.txt', 'w', encoding='utf-8')
sys.stdout = output_file

print("="*80)
print("TESTING INSTAMART CATEGORY-LISTING API")
print("="*80)
print(f"\nStore ID: {STORE_ID}")
print(f"Category: Fresh Fruits")
print(f"Endpoint: /api/instamart/category-listing/v2")
print(f"\nSending GET request...\n")

try:
    response = requests.get(url, headers=headers)
    print(f"Status Code: {response.status_code}\n")
    
    if response.status_code == 200:
        print("="*80)
        print("✅ SUCCESS! API WORKS!")
        print("="*80)
        
        data = response.json()
        
        # Save full response
        with open('instamart_category_response.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("\n✅ Full response saved to: instamart_category_response.json")
        
        # Analyze structure
        print("\n" + "="*80)
        print("RESPONSE STRUCTURE")
        print("="*80)
        if isinstance(data, dict):
            print("\nTop-level keys:")
            for key in data.keys():
                value_type = type(data[key]).__name__
                if isinstance(data[key], (list, dict)):
                    count = len(data[key])
                    print(f"  - {key} ({value_type}, {count} items)")
                else:
                    print(f"  - {key} ({value_type})")
        
        # Look for products
        print("\n" + "="*80)
        print("LOOKING FOR PRODUCT DATA")
        print("="*80)
        
        if 'data' in data and isinstance(data['data'], dict):
            print("\nKeys in 'data':")
            for key in data['data'].keys():
                print(f"  - {key}")
                
            if 'widgets' in data['data']:
                widgets = data['data']['widgets']
                print(f"\n✅ Found {len(widgets)} widgets")
                print("\nWidget types:")
                widget_types = {}
                for w in widgets:
                    wtype = w.get('type', 'unknown')
                    widget_types[wtype] = widget_types.get(wtype, 0) + 1
                for wtype, count in widget_types.items():
                    print(f"  - {wtype}: {count}")
        
    else:
        print(f"❌ Failed with status: {response.status_code}")
        print(f"\nResponse (first 1500 chars):\n{response.text[:1500]}")
        
except Exception as e:
    print(f"❌ Exception: {type(e).__name__}: {str(e)}")

print("\n" + "="*80)

output_file.close()
sys.stdout = sys.__stdout__
print("✅ Test complete! Results saved to api_test_output.txt")
