async function setZeptoLocation(page, loc) {
  console.log(`Setting Zepto location to: ${loc}`);
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Location setting attempt ${attempts}/${maxAttempts}`);

    try {
      if (!page.url().includes("zeptonow.com")) {
        await page.goto("https://www.zeptonow.com/", {
          waitUntil: 'domcontentloaded',
          timeout: 120000 // Increased timeout to 2 minutes
        });
      }

      try {
        // Use data-testid selectors for reliability
        console.log("Waiting for location button...");
        await page.waitForSelector('[data-testid="user-address"]', { timeout: 30000 });
        await page.click('[data-testid="user-address"]');
        console.log("Clicked location button");
        await new Promise(r => setTimeout(r, 2000));

        // Wait for address modal to appear
        console.log("Waiting for address modal...");
        await page.waitForSelector('[data-testid="address-modal"]', { timeout: 30000 });
        await new Promise(r => setTimeout(r, 1000));

        // Wait for and click the search input
        console.log("Waiting for search input...");
        await page.waitForSelector('[data-testid="address-search-input"] input[placeholder="Search a new address"]', { timeout: 30000 });
        await page.click('[data-testid="address-search-input"] input[placeholder="Search a new address"]');
        await new Promise(r => setTimeout(r, 500));

        // Type the location
        console.log(`Typing location: ${loc}`);
        await page.type('[data-testid="address-search-input"] input[placeholder="Search a new address"]', loc, { delay: 100 });
        await new Promise(r => setTimeout(r, 2000)); // Wait for suggestions to load

        // Wait for search results and click the first one
        console.log("Waiting for search results...");
        await page.waitForSelector('[data-testid="address-search-item"]', { timeout: 30000 });

        // Get all search items and click the first one
        const searchItems = await page.$$('[data-testid="address-search-item"]');
        if (searchItems.length > 0) {
          console.log(`Found ${searchItems.length} location suggestions, clicking first one`);
          await searchItems[0].click();
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw new Error("No location suggestions found");
        }

        // Click confirm button (look for button with "Confirm" text)
        console.log("Looking for confirm button...");
        const confirmButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(btn => btn.innerText.toLowerCase().includes('confirm'));
        });

        if (confirmButton) {
          await confirmButton.click();
          console.log("Clicked confirm button");
          await new Promise(r => setTimeout(r, 3000));
        } else {
          console.log("Confirm button not found, location may have been set automatically");
        }
      } catch (err) {
        console.error(`Error during Zepto location selection: ${err.message}`);
      }

      const locTitle = await isLocSet(page);
      if (locTitle) {
        console.log(`Zepto location successfully set to: ${locTitle}`);
        return locTitle;
      } else if (attempts < maxAttempts) {
        console.log(`Failed to verify Zepto location, retrying... (attempt ${attempts}/${maxAttempts})`);
        // Refresh page before retrying
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));
      } else {
        console.log(`Failed to verify Zepto location after ${maxAttempts} attempts`);
        return null;
      }
    } catch (err) {
      console.error(`Error setting Zepto location (attempt ${attempts}/${maxAttempts}):`, err);
      if (attempts >= maxAttempts) {
        return null;
      }
      // Wait before retrying
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  return null;
}

async function isLocSet(page) {
  console.log("Checking if Zepto location is set...");

  try {
    // Wait for page to settle
    await new Promise(r => setTimeout(r, 3000));

    // Check localStorage for user-position key (this is where Zepto stores location)
    const locationData = await page.evaluate(() => {
      try {
        const userPosStr = localStorage.getItem('user-position');
        if (!userPosStr) return null;

        const userPos = JSON.parse(userPosStr);

        // Check if we have valid location data
        if (userPos &&
          userPos.state &&
          userPos.state.userPosition &&
          userPos.state.userPosition.latitude &&
          userPos.state.userPosition.longitude) {

          const pos = userPos.state.userPosition;
          return {
            name: pos.name || pos.shortAddress || 'Unknown',
            latitude: pos.latitude,
            longitude: pos.longitude,
            address: pos.formattedAddress || pos.shortAddress || ''
          };
        }

        return null;
      } catch (e) {
        console.error('Error parsing user-position:', e);
        return null;
      }
    });

    if (locationData) {
      console.log(`Zepto location verified from localStorage: ${locationData.name} (${locationData.latitude}, ${locationData.longitude})`);
      return locationData.name;
    }

    // Fallback: check DOM selectors as backup
    console.log("Location not found in localStorage, checking DOM...");
    const selectors = [
      '.max-w-\\[170px\\] > span',
      '[data-testid="location-btn"]',
      '.font-medium.text-sm',
      '.font-heading'
    ];

    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (!el) continue;

        const txt = await page.$eval(sel, el => el.textContent.trim());
        if (txt && txt.length > 2 && !txt.toLowerCase().includes("select") && !txt.toLowerCase().includes("enter")) {
          console.log(`Zepto location found in DOM: "${txt}"`);
          return txt;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    console.log("Location not set - neither in localStorage nor DOM");
    return null;
  } catch (err) {
    console.error("Error checking if Zepto location is set:", err);
    return null;
  }
}

module.exports = {
  setZeptoLocation,
  isLocSet
};
