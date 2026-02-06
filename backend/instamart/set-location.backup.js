// Helper for robust waiting
async function safeWaitForSelector(page, selector, options = {}) {
  const maxRetries = 3;
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await page.waitForSelector(selector, options);
    } catch (err) {
      if (err.message.includes("frame got detached") ||
        err.message.includes("Execution context was destroyed") ||
        err.message.includes("Protocol error")) {
        console.log(`[SafeWait] Refinding selector ${selector} due to error: ${err.message}. Retry ${retries + 1}/${maxRetries}`);
        retries++;
        await new Promise(r => setTimeout(r, 1000));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed to find ${selector} after ${maxRetries} retries due to frame issues`);
}

// Helper to check for "Something went wrong" error and click Retry
async function checkForErrorAndRetry(page) {
  try {
    // Give a moment for potential error screen to render after click
    await new Promise(r => setTimeout(r, 1000));

    const errorDetected = await page.evaluate(() => {
      const errorText = document.body.innerText;
      // Common error phrases
      const hasErrorText = errorText.includes("Something went wrong") ||
        errorText.includes("Uh’oh") ||
        errorText.includes("refresh or come back later");

      if (hasErrorText) {
        // Try to find a Retry button - prioritize data-testid
        const retryBtn = document.querySelector('[data-testid="error-button"]') ||
          document.querySelector('button[aria-label="Retry"]') ||
          Array.from(document.querySelectorAll('button, div[role="button"], span[role="button"]'))
            .find(el => el.innerText.trim() === "Retry" || el.innerText.trim() === "RETRY" || el.innerText.trim() === "Try Again");

        if (retryBtn) {
          retryBtn.click();
          return { handled: true, type: 'retry' };
        }

        // If no Retry button, check for "Go To Home" (Unserviceable area?)
        const homeBtn = Array.from(document.querySelectorAll('button, a'))
          .find(el => el.innerText.toLowerCase().includes("go to home"));

        if (homeBtn) {
          return { handled: false, type: 'fatal_home' };
        }

        return { handled: false, type: 'unknown_error' };
      }
      return false; // No error detected
    });

    if (errorDetected) {
      if (errorDetected.handled && errorDetected.type === 'retry') {
        console.log("[Instamart] Error screen detected. Clicked 'Retry'. Waiting for reload...");
        await new Promise(r => setTimeout(r, 3000));
        return true; // Successfully clicked retry
      } else if (errorDetected.type === 'fatal_home') {
        console.log("[Instamart] Fatal error detected (Go To Home). Location likely unserviceable.");
        return true; // Return true to signal "Error State", triggering retry loop (maybe different coordinates/browser restart helps)
      } else {
        console.log("[Instamart] Unhandled error screen detected.");
        return true; // Signal error presence
      }
    }
  } catch (e) {
    // Ignore errors during error check
  }
  return false;
}

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

          await page.goto("https://www.swiggy.com/instamart", {
            waitUntil: "domcontentloaded", // Faster than networkidle2
            timeout: 60000 // 60s timeout
          });

          // Verify we are not on about:blank
          if (page.url() === "about:blank") {
            throw new Error("Navigation failed, remained on about:blank");
          }
        } else {
        }

        // Check for error screen immediately after load
        await new Promise(r => setTimeout(r, 2000));
        const retryClicked = await checkForErrorAndRetry(page);
        if (retryClicked) {
          await new Promise(r => setTimeout(r, 3000));
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

    // Inner function to attempt setting location (allows for restarting on error)
    const attemptSetLocation = async () => {

      // PRIORITY: Check if search-location popup is visible first (this appears on initial load)
      const searchSelector = '[data-testid="search-location"]';
      const addressSelector = '[data-testid="address-name"]';
      const defaultAddressSelector = '[data-testid="DEFAULT_ADDRESS_CONTAINER"]';
      let foundSelector = null;

      // First check if search-location is immediately visible (the popup)
      const searchLocationExists = await page.$(searchSelector);

      if (searchLocationExists) {
        foundSelector = searchSelector;

        try {
          await page.click(searchSelector);
          await new Promise(r => setTimeout(r, 2000)); // Wait for search input to appear

          // Check for errors after clicking search-location
          const errorAfterClick = await checkForErrorAndRetry(page);
          if (errorAfterClick) {
            return false;
          }
        } catch (err) {
        }
      } else {
        // If no popup, try other selectors (fallback for different UI states)
        try {
          foundSelector = await Promise.race([
            safeWaitForSelector(page, addressSelector, { timeout: 5000 }).then(() => addressSelector).catch(() => null),
            safeWaitForSelector(page, defaultAddressSelector, { timeout: 5000 }).then(() => defaultAddressSelector).catch(() => null),
          ]);

          if (foundSelector === addressSelector) {
            await page.click(addressSelector).catch(() => { });
            await new Promise(r => setTimeout(r, 1500));
          } else if (foundSelector === defaultAddressSelector) {
            const titleClicked = await page.evaluate(() => {
              const title = document.querySelector('[data-testid="DEFAULT_ADDRESS_TITLE"]');
              if (title) {
                title.click();
                return true;
              }
              const container = document.querySelector('[data-testid="DEFAULT_ADDRESS_CONTAINER"]');
              if (container) {
                container.click();
                return true;
              }
              return false;
            });
            if (!titleClicked) {
              await page.click(defaultAddressSelector).catch(() => { });
            }
            await new Promise(r => setTimeout(r, 1500));

            // After clicking, check if search-location button appeared in modal
            const searchLocationDiv = await page.$('[data-testid="search-location"]');
            if (searchLocationDiv) {
              await searchLocationDiv.click();
              await new Promise(r => setTimeout(r, 1500));
            }
          } else {
            const retried = await checkForErrorAndRetry(page);
            if (retried) return false;
          }
        } catch (e) {
          console.log("Error checking entry points:", e.message);
        }
      }

      const searchInputSelectors = [
        'input._1wkJd', // Input field in search view (class from Instamart CSS)
        '[placeholder="Search for area, street name\\2026"]',
        '[placeholder*="Search for area"]',
        '[placeholder*="Search for an area"]',
        'input[placeholder="Search for area, street name..."]',
        'input[placeholder*="Search"]',
        '[data-testid="search-location-input"]',
        'input._381fS', // Legacy class backup
        '.gwpTv input', // Input inside search container
        'input[type="text"]', // Generic text input as last resort
      ];

      let searchInputSelector = null;
      for (const sel of searchInputSelectors) {
        try {
          // Short timeout for each to cycle through quickly
          if (await page.$(sel)) {
            searchInputSelector = sel;
            break;
          }
        } catch (e) { }
      }

      if (!searchInputSelector) {
        // Try waiting for the most generic one
        try {
          searchInputSelector = '[placeholder*="Search"]';
          await safeWaitForSelector(page, searchInputSelector, { timeout: 5000 });
        } catch (e) {
          console.log("Failed to find search input, dumping html...");
          try {
            const fs = require('fs');
            const html = await page.content();
            fs.writeFileSync('instamart_debug_dump.html', html);
            console.log("Dumped HTML to instamart_debug_dump.html");
          } catch (fsErr) {
            console.log("Failed to dump HTML to file:", fsErr.message);
          }
          throw new Error("Could not find location search input");
        }
      }

      await page.click(searchInputSelector);

      // Type the location

      // Ensure the input we found is still valid/visible
      await safeWaitForSelector(page, searchInputSelector, { timeout: 10000 });

      // Clear the input field first to prevent "mumbaimumbai" (buffering/retry issue)
      await page.evaluate((selector) => {
        const input = document.querySelector(selector);
        if (input) {
          input.value = '';
          // Trigger events to notify framework of change
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, searchInputSelector);

      // Wait a bit for clearing to take effect
      await new Promise(r => setTimeout(r, 500));

      // Type slower to look human and ensure UI catches up
      await page.type(searchInputSelector, loc, { delay: 200 });

      // Check for errors after typing location
      const errorAfterTyping = await checkForErrorAndRetry(page);
      if (errorAfterTyping) {
        return false;
      }

      // Wait for location suggestions and click the first one
      console.log("Waiting for location suggestions...");
      await new Promise(r => setTimeout(r, 2000));

      // Robust suggestion selection
      try {
        await safeWaitForSelector(page, 'div[class*="_1"]', { timeout: 5000 }); // Generic wait for results
      } catch (e) { }

      const clickedSuggestion = await page.evaluate(() => {
        // Strategy 1: Look for specific classes from user screenshot
        // The screenshot shows wrapper _11n32 and inner _2esgM
        const items = Array.from(document.querySelectorAll('div._11n32, div._2esgM'));

        if (items.length > 0) {
          console.log(`Found ${items.length} suggestions.`);
          items[0].click();
          return true;
        }

        // Strategy 2: Fallback to any button-like element in the results container
        const genericItems = Array.from(document.querySelectorAll('div[data-testid="search-result-item"], [class*="suggestion"]'));
        if (genericItems.length > 0) {
          genericItems[0].click();
          return true;
        }

        return false;
      });

      if (!clickedSuggestion) {
        // Fallback: Click mostly likely area of first result (adjusted coordinates if needed)
        await page.mouse.click(300, 250).catch(e => { });
      }

      // Click on confirm location button
      console.log("Confirming location...");
      await new Promise(r => setTimeout(r, 2000));

      // Wait for potential random popup (deal/item)
      console.log("Waiting for random popup...");
      await new Promise(r => setTimeout(r, 2000));

      // Handle random blocking popups BEFORE confirming
      try {
        await page.evaluate(() => {
          const closeSelectors = [
            'button[aria-label*="close"]',
            'button[aria-label*="Close"]',
            'svg[data-testid="close-button"]',
            '[class*="close"]',
            '[class*="Close"]',
            '.icon-close-thin', // Common wrapper class
            '._11n32' // Sometimes close buttons are inside this wrapper? No, that was the list.
          ];

          // Check specifically for the random item popup
          const overlays = document.querySelectorAll('[class*="overlay"], [class*="modal"], [role="dialog"]');
          if (overlays.length > 0) {
            console.log(`Found ${overlays.length} overlays/modals. Trying to close...`);
            overlays.forEach(overlay => {
              // Try to find a close button within the overlay
              const closeBtn = overlay.querySelector('button, svg, [role="button"]');
              if (closeBtn) closeBtn.click();
            });
          }

          // Generic close button clicking
          closeSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
              const rect = el.getBoundingClientRect();
              // Heuristic: visible and smallish
              if (rect.width > 0 && rect.width < 100 && rect.height > 0 && rect.height < 100) {
                el.click();
              }
            });
          });
        });
      } catch (e) {
        console.log("Pre-confirmation popup check failed:", e);
      }

      // Check for error screen (like Something went wrong) which might have appeared instead of confirmation
      const retriedError = await checkForErrorAndRetry(page);
      if (retriedError) return false; // Signal to restart

      // Click on confirm location button

      // Robust confirm button finder - Get Coordinates
      const confirmBtnBox = await page.evaluate(() => {
        // Priority: Specific classes from user screenshot
        // button.sc-iGgWBj, span.jvMXGN ("Confirm Location")
        const specificBtn = document.querySelector('button.sc-iGgWBj, span.jvMXGN');
        let target = null;

        if (specificBtn) {
          // Click the button itself if we found the span
          target = specificBtn.tagName === 'BUTTON' ? specificBtn : specificBtn.closest('button');
        }

        if (!target) {
          const buttons = Array.from(document.querySelectorAll('button'));
          target = buttons.find(b => {
            const txt = b.innerText.toLowerCase();
            return txt.includes('confirm') || txt.includes('continue') || txt.includes('proceed');
          });
        }

        if (target) {
          const rect = target.getBoundingClientRect();
          // Return non-zero rect validation
          if (rect.width > 0 && rect.height > 0) {
            return {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            };
          }
        }
        return null;
      });

      if (confirmBtnBox) {
        // Calculate center
        const clickX = confirmBtnBox.x + (confirmBtnBox.width / 2);
        const clickY = confirmBtnBox.y + (confirmBtnBox.height / 2);

        // Move and click
        await page.mouse.move(clickX, clickY);
        await page.mouse.down();
        await new Promise(r => setTimeout(r, 100)); // Short hold
        await page.mouse.up();

      } else {
        await page.evaluate(() => {
          const specificBtn = document.querySelector('button.sc-iGgWBj, span.jvMXGN');
          if (specificBtn) specificBtn.click();
        });
      }

      // Post-Click Verification: Wait for the button to disappear or the address element to appear
      try {
        await page.waitForFunction(() => {
          const btn = document.querySelector('button.sc-iGgWBj, span.jvMXGN');
          if (!btn) return true; // Button gone
          return btn.offsetParent === null; // Button hidden
        }, { timeout: 5000 });
      } catch (timeout) {
        return false; // Trigger retry since the button is still there
      }

      // Check for error screen (like Something went wrong) which might have appeared instead of confirmation
      // THIS IS NOW INSIDE THE LOOP
      const retriedErrorAfterConfirm = await checkForErrorAndRetry(page);
      if (retriedErrorAfterConfirm) {
        return false; // Signal to restart
      }


      return true; // Success
    };

    // Try loop for location setting
    let success = false;
    for (let i = 0; i < 4; i++) { // Increased retries to handle sequential errors
      success = await attemptSetLocation();
      if (success) break;
      await new Promise(r => setTimeout(r, 2000));
    }

    // Attempt to wait for ANY of the address selectors to appear
    try {
      await page.waitForFunction(() => {
        const selectors = [
          '[data-testid="address-line"]',
          '[data-testid="address-name"]',
          '._3FN4I',
          '._3eFQ-',
          '.location-address',
          '.address-text',
          'div[class*="address"]',
          'span[class*="address"]'
        ];
        return selectors.some(s => document.querySelector(s));
      }, { timeout: 8000 });
    } catch (e) { }

    // Final navigation check
    if (page.url() === "about:blank") {
      console.log("Page crashed to about:blank, attempting recovery...");
      await page.goto("https://www.swiggy.com/instamart", { waitUntil: "domcontentloaded" });
    }

    // Verify location was set
    const locTitle = await isLocationSet(page);
    if (locTitle) {
      console.log(`Instamart location successfully set to: ${locTitle}`);

      // Extract storeId
      const storeInfo = await page.evaluate(() => {
        try {
          // 1. Try localStorage 'userLocation' (common pattern)
          const locData = localStorage.getItem('userLocation');
          if (locData) {
            const parsed = JSON.parse(locData);
            if (parsed.storeId) return parsed.storeId;
          }

          // 2. Try cookies
          const match = document.cookie.match(/storeId=([^;]+)/);
          if (match) return match[1];

          return null;
        } catch (e) { return null; }
      });

      console.log(`[DEBUG-INSTAMART] Extracted Store ID: ${storeInfo}`);
      return { location: locTitle, storeId: storeInfo };
    } else {
      console.log(`Failed to verify Instamart location after setting to: ${loc}`);
      // Capture state for debugging
      await page.screenshot({ path: 'instamart_verification_failed_debug.png' });
      console.log(`[DEBUG-INSTAMART] Screenshot saved. Check instamart_verification_failed_debug.png`);
      return null;
    }
  } catch (err) {
    console.error("Error setting Instamart location:", err);
    return null;
  }
}

async function isLocationSet(page) {
  console.log("[Instamart] Checking if location is set...");

  try {
    // Try different selectors that might contain location information
    const selectors = [
      '[data-testid="address-line"]', // User suggested robust selector
      '[data-testid="address-name"]',
      '._3FN4I',
      '._3eFQ-',
      '.location-address',
      '.address-text',
      'div[class*="address"]',
      'span[class*="address"]'
    ];

    for (const sel of selectors) {
      try {
        const elements = await page.$$(sel);
        for (const el of elements) {
          const txt = await page.evaluate(e => e.textContent.trim(), el);


          // Filter out common non-address headers like "Delivery to", "9 mins", "Work", "Home"
          const lowerTxt = txt.toLowerCase();
          if (txt && txt.length > 5 && // Address should be reasonably long
            !lowerTxt.includes("delivery to") &&
            !lowerTxt.includes("mins") &&
            !lowerTxt.includes("select") &&
            !lowerTxt.includes("enter location") &&
            !lowerTxt.includes("other") &&
            !lowerTxt.match(/^\d+$/) // Exclude pure numbers
          ) {
            console.log(`[Instamart] Location successfully verified: "${txt}"`);
            return txt;
          }
        }
      } catch (e) {
        // Continue to next selector if this one fails
      }
    }

    // Check if we're on the main page with products
    const isMain = await page.evaluate(() => {
      // If we see the main product grid or categories, we are likely inside
      return document.querySelector('[data-testid="category-container"]') !== null ||
        document.querySelector('[data-testid="home-page"]') !== null ||
        document.querySelectorAll('[data-testid="product-card"]').length > 0;
    });

    if (isMain) {
      console.log("[Instamart] On main page with products, assuming location is set");
      return "Location Set (Main Page Detected)";
    }

    return null;
  } catch (err) {
    console.error("[Instamart] Error checking if location is set:", err);
    try {
      await page.screenshot({ path: 'instamart_location_verification_failed.png' });
    } catch (e) { }
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
