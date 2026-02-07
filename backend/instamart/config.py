"""
Configuration file for Instamart API Scraper
User must update COOKIE_STRING with fresh cookies from browser
"""

# ============================================================================
# USER CONFIGURATION - UPDATE THESE VALUES
# ============================================================================

# Cookie string from browser DevTools (expires in ~1 hour)
# How to get:
# 1. Open https://www.swiggy.com/instamart in browser
# 2. Open DevTools (F12) -> Network tab
# 3. Find any API request
# 4. Copy the entire 'Cookie:' header value
COOKIE_STRING = "__SW=dEQ-6lrSDsElfzAM0xysFl98BG4lSZkt; _device_id=fe983fce-0fca-4cbd-8cd0-2431da279535; _gcl_au=1.1.1894882929.1769065141; fontsLoaded=1; _ga=GA1.1.70300472.1769065144; deviceId=s%3Afe983fce-0fca-4cbd-8cd0-2431da279535.pgR%2BBMHiamWcdG2ofP0kzJ%2BFnxFGhEn33isogQnVux8; versionCode=1200; platform=web; statusBarHeight=0; bottomOffset=0; genieTrackOn=false; isNative=false; openIMHP=false; _fbp=fb.1.1769853494109.605092661902406423; moe_uuid=f60502a6-c4bd-4c9f-9e49-dc566d20577a; _ga_34JYJ0BCRN=GS2.1.s1770284467$o3$g0$t1770284471$j56$l0$h0; _ga_YE38MFJRBZ=GS2.1.s1770284467$o3$g1$t1770284512$j15$l0$h0; addressId=s%3A.4Wx2Am9WLolnmzVcU32g6YaFDw0QbIBFRj2nkO7P25s; ally-on=false; strId=; LocSrc=s%3AswgyUL.Dzm1rLPIhJmB3Tl2Xs6141hVZS0ofGP7LGmLXgQOA7Y; isImBottomBarXpEnabled=s%3Atrue.e48T%2B1OIqhnOplwfDLfBpm6ciWJemq9CxKQOhhXd4VA; application_name=; category=; x-channel=; x-theme=; _guest_tid=e2a91aa4-5a4a-4e67-b018-33af56150b11; _swuid=fe983fce-0fca-4cbd-8cd0-2431da279535; _ga_X3K3CELKLV=GS2.1.s1770444269$o1$g0$t1770444270$j59$l0$h0; tid=s%3A23ffb4c8-5d92-47d8-88e7-0861d8dd3a9a.aC6rG9ACji1EtjLjwORswhQLXUbDWvnDWNclSUywjHo; sid=s%3Apkgce4cc-46ed-45ae-951b-815793eaa170.k9BDdLDF4YOYsSK5sdGL%2FD5cjD2UPH28Oo0ZzcHp%2B5g; lat=s%3A18.9690247.kEUzj0AVvWevFJbyZs1Zl2ri9vlpqA0dsnX8wJnWjVY; lng=s%3A72.8205292.FJoY%2BM0uCPUiJcqQv%2BZKQnj7tTdXeZ3B7h9EMRx%2FRC4; address=s%3AMumbai%20Central%2C%20Mumbai%2C%20Maharashtra%2C%20India.5aM3sL01qiU1hPKBaLGOEU%2FqVKC7PGorOKXVq3tmOXo; userLocation=%7B%22address%22%3A%22Mumbai%20Central%2C%20Mumbai%2C%20Maharashtra%2C%20India%22%2C%22lat%22%3A18.9690247%2C%22lng%22%3A72.8205292%2C%22id%22%3A%22%22%2C%22annotation%22%3A%22Mumbai%20Central%2C%20Mumbai%2C%20Maharashtra%2C%20India%22%2C%22name%22%3A%22%22%7D; subplatform=dweb; webBottomBarHeight=0; _ga_8N8XRG907L=GS2.1.s1770460563$o13$g1$t1770464640$j60$l0$h0; _ga_0XZC5MS97H=GS2.1.s1770460564$o13$g1$t1770464640$j60$l0$h0; _ga_VEG1HFE5VZ=GS2.1.s1770460564$o13$g1$t1770464640$j60$l0$h0; aws-waf-token=41bd496b-e21c-4573-8fa5-d679ed99941e:BQoAsgdQ/SqHAAAA:s0ko7JeZJa8XYuympTqFoPIj5kvRnCU2Zzkl5Bl7HM9IWXAp1nyIWx8caK5bt/ZMuxmbvHNS0R3nMhvuasC/488bqgHP2dPwc2rbWLLYyZZBkIhnkSyM/0yQMbVR0vR7jCUEPpfJFDnmsqyNV59M/idxY6Ol401APiIKLedHYQUR0AAibuJtOtSJdHJAiemXJ5KimOQk3qMFS2mEHLdhI7q7NV2rHh5RY1nQQUgaoatlkQecYRmsYAOnIZUQtiEdV9PnsOQ="
# Store ID (location-specific)
# Find this in API URLs when browsing Instamart
STORE_ID = "1135722"

# ============================================================================
# API ENDPOINTS
# ============================================================================

API_BASE = "https://www.swiggy.com/api/instamart"

ENDPOINTS = {
    "category_listing": f"{API_BASE}/category-listing/v2",
    "search": f"{API_BASE}/search/v2",
    "home": f"{API_BASE}/home/v2",
}

# ============================================================================
# CATEGORIES TO SCRAPE
# ============================================================================

CATEGORIES = [
    {"name": "Frozen Food", "taxonomyType": "Speciality taxonomy 3"},
]

# ============================================================================
# REQUEST CONFIGURATION
# ============================================================================

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
    'Accept': '*/*',
}

# Request delays (seconds)
REQUEST_DELAY = 1.0  # Delay between requests to avoid rate limiting

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds

# ============================================================================
# OUTPUT CONFIGURATION
# ============================================================================

OUTPUT_DIR = "scraped_data/instamart"
OUTPUT_FORMAT = "json"  # json or csv
