# Instamart Scraping - User Guide

## 🚀 Simple 3-Step Workflow

### Step 1: Set Location (One Time)
In your frontend UI:
1. Select service: **Instamart**
2. Enter location: `Mumbai Central, Mumbai`
3. Click "Set Location"

**What happens automatically:**
- ⏳ Browser opens briefly (in background)
- 🔑 Cookies extracted automatically
- 💾 Saved to `cookies.json`
- ✅ Ready to scrape!

**Duration:** ~5-10 seconds (one time only)

---

### Step 2: Select Category
1. Choose category: `Fresh Fruits`, `Chips and Namkeens`, etc.
2. Click "Scrape"

**What happens automatically:**
- ⚡ Loads saved cookies
- 📡 Makes API calls (super fast!)
- 📊 Returns products in 2-5 seconds

---

### Step 3: Get Results
- Excel file generated
- Products displayed in UI
- ✅ Done!

---

## 🔄 Automatic Cookie Management

**You NEVER need to:**
- Run `cookieExtractor.js` manually
- Copy cookies from DevTools
- Do any manual setup

**The system automatically:**
- ✅ Extracts cookies when you set location
- ✅ Re-extracts if cookies expire
- ✅ Falls back if scrape fails

---

## 📋 Complete Flow Example

```
USER ACTION                 → BACKEND (Automatic)
────────────────────────────────────────────────────────

1. Set Location             → Opens browser
   "Mumbai Central"         → Extracts cookies
                            → Saves cookies.json
                            ✅ Done!

2. Scrape "Fresh Fruits"    → Loads cookies.json
                            → API calls to Instamart
                            → Extracts products
                            ✅ Done in 3 seconds!

3. Scrape "Snacks"          → Uses same cookies
                            → API calls
                            ✅ Done in 2 seconds!

[1 hour later, cookies expire]

4. Scrape "Beverages"       → Detects expired cookies
                            → Auto re-extracts (browser opens)
                            → Continues scraping
                            ✅ Done!
```

---

## ⚠️ Troubleshooting

### "Auto cookie extraction failed"
**Cause:** Browser couldn't open or location setting failed

**Fix:** Manually set location again via UI

---

### Scraping is slow
**Cause:** Cookies expired, system is re-extracting

**Expected:** First scrape after expiry takes 5-10 sec, then fast again

---

## 🎯 Summary

**Your workflow:**
1. Set location (once)
2. Scrape categories (as many as you want)
3. That's it!

**No manual steps. No technical commands. Just use the UI!** 🚀
