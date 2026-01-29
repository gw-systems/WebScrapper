async function setInstamartLocation(page, loc) {
  console.log(`Setting Instamart location to: ${loc}`);

  try {
    // Retry mechanism for navigation
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const currentUrl = page.url();
        // Check if already on Instamart or if page is blank/error
        if (!currentUrl.includes("swiggy.com/instamart") || currentUrl === "about:blank") {
          console.log(`Navigating to Instamart (Attempt ${attempts}/${maxAttempts})...`);

          await page.goto("https://www.swiggy.com/instamart", {
            waitUntil: "domcontentloaded", // Faster than networkidle2
            timeout: 60000 // 60s timeout
          });

          // Verify we are not on about:blank
          if (page.url() === "about:blank") {
            throw new Error("Navigation failed, remained on about:blank");
          }
        } else {
          console.log("Already on Instamart page");
        }
        break; // Success
      } catch (navError) {
        console.error(`Navigation attempt ${attempts} failed: ${navError.message}`);
        if (attempts >= maxAttempts) throw new Error("Failed to load Instamart after retries");
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Set viewport for consistent rendering
    await page.setViewport({ width: 1536, height: 695 });

    // Click on the address/location button
    console.log("Clicking on location button...");
    await page.waitForSelector('[data-testid="address-name"]', { timeout: 10000 })
      .catch(e => console.log("Address name selector not found, trying to proceed anyway..."));

    await page.click('[data-testid="address-name"]')
      .catch(e => console.log("Click on address name failed, retrying..."));

    // Click on search location field
    console.log("Opening location search...");
    await page.waitForSelector('[data-testid="search-location"]', { timeout: 10000 });
    try {
      await Promise.all([
        page.click('[data-testid="search-location"]'),
        page.waitForNavigation({ timeout: 10000 }).catch(() => { })
      ]);
    } catch (err) {
      console.log("Navigation after clicking search location may not have occurred:", err.message);
    }

    // Wait for and click on the location search input field
    console.log("Focusing location search input...");
    await page.waitForSelector('[placeholder="Search for area, street name\\2026"]', { timeout: 10000 });
    await page.click('[placeholder="Search for area, street name\\2026"]');

    // Type the location
    console.log(`Typing location search: ${loc}`);
    await page.waitForSelector('[placeholder="Search for area, street name\\2026"]:not([disabled])', { timeout: 10000 });
    await page.type('[placeholder="Search for area, street name\\2026"]', loc);

    // Wait for location suggestions and click the first one
    console.log("Waiting for location suggestions...");
    await new Promise(r => setTimeout(r, 2000));

    // Robust suggestion selection
    try {
      await page.waitForSelector('div[class*="_1"]', { timeout: 5000 }); // Generic wait for results
    } catch (e) { }

    const clickedSuggestion = await page.evaluate(() => {
      // Strategy 1: Look for common list item classes used by Swiggy
      const items = Array.from(document.querySelectorAll('div[role="button"], div[class*="suggestion"], ._11n32'));
      if (items.length > 0) {
        items[0].click();
        return true;
      }
      return false;
    });

    if (!clickedSuggestion) {
      console.log("Using fallback click for suggestion");
      // Fallback: Click mostly likely area of first result
      await page.mouse.click(300, 200).catch(e => { });
    }

    // Click on confirm location button
    console.log("Confirming location...");
    await new Promise(r => setTimeout(r, 2000));

    // Robust confirm button finder
    const clickedConfirm = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find(b => {
        const txt = b.innerText.toLowerCase();
        return txt.includes('confirm') || txt.includes('continue') || txt.includes('proceed');
      });

      if (target) {
        target.click();
        return true;
      }
      return false;
    });

    if (!clickedConfirm) {
      // Fallback for fragile class selector
      const confirmBtn = await page.$('._2xPHa').catch(() => null);
      if (confirmBtn) await confirmBtn.click();
      else console.log("Confirm button not found via text or class");
    }

    // Wait for location to be set
    await new Promise(r => setTimeout(r, 3000));

    // Handle potential popups/interstitials
    console.log("Checking for popups...");
    try {
      await page.evaluate(() => {
        // aggressive cleanup of overlays
        const overlays = document.querySelectorAll('[class*="overlay"], [class*="modal"]');
        overlays.forEach(el => {
          if (el.innerText.includes("close") || el.innerText.includes("skip")) {
            el.click();
          }
        });

        // Click common close buttons
        const closeBtns = document.querySelectorAll('button[aria-label="close"], span[class*="close"], svg[class*="close"]');
        closeBtns.forEach(btn => btn.parentElement?.click());
      });
    } catch (e) { console.log("Popup check skipped"); }

    // Final navigation check
    if (page.url() === "about:blank") {
      console.log("Page crashed to about:blank, attempting recovery...");
      await page.goto("https://www.swiggy.com/instamart", { waitUntil: "domcontentloaded" });
    }

    // Verify location was set
    const locTitle = await isLocationSet(page);
    if (locTitle) {
      console.log(`Instamart location successfully set to: ${locTitle}`);
      return locTitle;
    } else {
      console.log(`Failed to verify Instamart location after setting to: ${loc}`);
      return null;
    }
  } catch (err) {
    console.error("Error setting Instamart location:", err);
    return null;
  }
}

async function isLocationSet(page) {
  console.log("Checking if Instamart location is set...");

  try {
    // Try different selectors that might contain location information
    const selectors = [
      '[data-testid="address-name"]',
      '._3FN4I',
      '._3eFQ-',
      '.location-address',
      '.address-text'
    ];

    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (!el) continue;

        const txt = await page.$eval(sel, el => el.textContent.trim());
        if (txt && txt.length > 2 && !txt.toLowerCase().includes("other") &&
          !txt.toLowerCase().includes("select") && !txt.toLowerCase().includes("enter")) {
          console.log(`Instamart location found: "${txt}"`);
          return txt;
        }
      } catch (e) {
        // Continue to next selector if this one fails
      }
    }

    // Check if we're on the main page with products
    const isMain = await page.evaluate(() => {
      return document.querySelector('.product-grid, [class*="product-list"], [class*="items-container"]') !== null;
    });

    if (isMain) {
      console.log("On Instamart main page with products, assuming location is set");
      return "Location Set";
    }

    return null;
  } catch (err) {
    console.error("Error checking if Instamart location is set:", err);
    return null;
  }
}

// Custom function to handle delivery time
async function getDeliveryTime(page) {
  try {
    // Try to find delivery time information
    const deliveryTimeSelectors = [
      '.delivery-time',
      '.eta-text',
      '[data-testid="delivery-time"]',
      '[class*="delivery-time"]',
      '[class*="eta"]'
    ];

    for (const sel of deliveryTimeSelectors) {
      try {
        const el = await page.$(sel);
        if (!el) continue;

        const deliveryTime = await page.$eval(sel, el => el.textContent.trim());
        if (deliveryTime) {
          // If delivery time is "earliest", return 10 mins as specified
          if (deliveryTime.toLowerCase().includes("earliest")) {
            console.log("Delivery time is 'earliest', returning 10 mins");
            return "10 mins";
          }
          console.log(`Found delivery time: ${deliveryTime}`);
          return deliveryTime;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    console.log("Delivery time not found, defaulting to 10 mins");
    return "10 mins"; // Default value if not found
  } catch (err) {
    console.error("Error getting delivery time:", err);
    return "10 mins"; // Default fallback
  }
}

module.exports = {
  setInstamartLocation,
  isLocationSet,
  getDeliveryTime
};
