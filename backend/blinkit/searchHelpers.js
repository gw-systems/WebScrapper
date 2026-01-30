async function navigateToSearch(page, searchTerm) {
  console.log(`Directly navigating to search URL with term: ${searchTerm}`);

  try {
    const encSearchTerm = encodeURIComponent(searchTerm);
    console.log(`Going to: https://blinkit.com/s/?q=${encSearchTerm}`);
    const resp = await page.goto(`https://blinkit.com/s/?q=${encSearchTerm}`, {
      waitUntil: 'networkidle2',
      timeout: 50000
    });

    const url = await page.url();
    console.log(`Current page URL: ${url}`);
    await new Promise(r => setTimeout(r, 2000));
    return true;
  } catch (err) {
    console.log(`Error navigating to search URL: ${err.message}`);
    return false;
  }
}

async function ensureContentLoaded(page) {
  try {
    try {
      const loadSel = '.LoadingIcon, .spinner, [class*="loading"], [class*="Loading"]';
      const hasLoader = await page.$(loadSel);

      if (hasLoader) {
        await page.waitForSelector(loadSel, { hidden: true, timeout: 10000 });
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (loadErr) {
      console.log("No loading indicator found or timeout waiting for it to disappear");
    }

    const contentSels = [
      'div[role="button"][id]',
      'div[id][data-pf="reset"]',
      '.ProductCard__Wrapper',
      '[data-testid*="product"]',
      'div.tw-flex-col[id]',
      'div[class*="product"]'
    ];

    let found = false;

    for (const sel of contentSels) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        console.log(`Found content with selector: ${sel}`);
        found = true;
        break;
      } catch (err) {
        console.log(`Selector ${sel} not found: ${err.message}`);
      }
    }

    if (!found) {
      try {
        const noResSel = '.EmptySearchResults, [class*="empty"], [class*="no-results"]';
        const noRes = await page.$(noResSel);

        if (noRes) {
          console.log("Found 'no results' indicator");
          return true;
        }
      } catch (noResErr) {
        console.log("No 'no results' indicator found");
      }

      console.log("No standard content selectors found, waiting extra time...");
      await new Promise(r => setTimeout(r, 5000));
      const hasContent = await page.evaluate(() => {
        const hasImgs = document.querySelectorAll('img').length > 3;
        const hasPrices = Array.from(document.querySelectorAll('*')).some(el =>
          el.textContent && el.textContent.includes('₹'));

        return hasImgs || hasPrices;
      });

      if (hasContent) {
        console.log("Found generic content indicators");
        found = true;
      }
    }
    return found;
  } catch (err) {
    console.log(`Error ensuring content loaded: ${err.message}`);
    return true;
  }
}

function extractProductInformation(prodJson) {
  console.log("Extracting product information from JSON response...");
  const prods = [];

  if (!prodJson || !prodJson.response || !Array.isArray(prodJson.response.snippets)) {
    console.error("Error: Invalid JSON structure. Expected 'response.snippets' array.", prodJson);
    return prods;
  }

  const snippets = prodJson.response.snippets;

  snippets.forEach((snip, idx) => {
    if (!snip.data ||
      snip.widget_type === "image_text_vr_type_header" ||
      !snip.data.name ||
      !snip.data.identity ||
      snip.data.identity.id === "product_container") {
      return;
    }

    const raw = snip.data;

    try {
      const id = raw.identity.id || `product_${idx}`;
      const name = raw.name && raw.name.text ? raw.name.text : 'Product Name Not Available';

      let price = 'Price Not Available';
      if (raw.normal_price && raw.normal_price.text) {
        price = raw.normal_price.text;
      } else if (raw.price && typeof raw.price === 'number') {
        price = `₹${raw.price.toFixed(2)}`;
      }

      let origPrice = null;
      if (raw.mrp && raw.mrp.text) {
        origPrice = raw.mrp.text;
      }

      const qty = raw.variant && raw.variant.text ? raw.variant.text : 'N/A';
      const imgUrl = raw.image && raw.image.url ? raw.image.url : '';
      const delTime = raw.eta_tag && raw.eta_tag.title && raw.eta_tag.title.text ?
        raw.eta_tag.title.text : 'N/A';

      let disc = null;
      if (raw.offer_tag && raw.offer_tag.title && raw.offer_tag.title.text) {
        disc = raw.offer_tag.title.text.replace(/\n/g, ' ');
      }

      const avail = raw.hasOwnProperty('is_sold_out') ? !raw.is_sold_out :
        (raw.hasOwnProperty('inventory') ? raw.inventory > 0 : true);

      let savings = null;
      if (origPrice && price) {
        const prMatch = price.match(/₹\s*(\d+(?:\.\d+)?)/);
        const opMatch = origPrice.match(/₹\s*(\d+(?:\.\d+)?)/);

        if (prMatch && opMatch) {
          const curPrice = parseFloat(prMatch[1]);
          const orgPrice = parseFloat(opMatch[1]);

          if (!isNaN(orgPrice) && !isNaN(curPrice) && orgPrice > curPrice) {
            savings = `₹${(orgPrice - curPrice).toFixed(0)}`;
          }
        }
      }

      prods.push({
        id,
        name,
        price,
        originalPrice: origPrice,
        savings,
        quantity: qty,
        deliveryTime: delTime,
        discount: disc,
        imageUrl: imgUrl,
        available: avail
      });

    } catch (err) {
      console.error(`Error processing product data for snippet at index ${idx}: ${err.message}`, raw);
    }
  });

  console.log(`Successfully processed ${prods.length} products from JSON response.`);
  return prods;
}

/**
 * Orchestrates product scraping for a search term
 * @param {Object} page - Puppeteer page instance
 * @param {string} searchTerm - The search term to query
 * @returns {Promise<Array>} Array of product objects
 */
async function scrapeProducts(page, searchTerm) {
  console.log(`Starting Blinkit search for: ${searchTerm}`);

  let responseHandler = null;

  try {
    // 1. Setup response interception for JSON API
    let productJsonResponse = null;

    // Create a promise that resolves when we get the API response
    const productJsonPromise = new Promise((resolve) => {
      responseHandler = async (response) => {
        const url = response.url();
        const type = response.request().resourceType();

        if (type === "xhr" || type === "fetch") {
          try {
            // Blinkit API typically returns product data in response.snippets format
            const json = await response.json().catch(() => null);

            if (json &&
              json.response &&
              Array.isArray(json.response.snippets) &&
              json.response.snippets.length > 0) {

              // Check if this response actually has product data (not just pill containers etc)
              const hasProducts = json.response.snippets.some(s =>
                s.data &&
                s.data.name &&
                s.data.identity &&
                s.widget_type !== "pill_container_snippet" &&
                s.widget_type !== "image_text_vr_type_header"
              );

              if (hasProducts) {
                console.log(`Captured Blinkit product JSON from: ${url}`);
                resolve({ json, url });
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      };

      page.on("response", responseHandler);

      // Timeout fallback
      setTimeout(() => {
        resolve({ timeout: true });
      }, 30000);
    });

    // 2. Navigate to search page
    const navigationSuccess = await navigateToSearch(page, searchTerm);

    if (!navigationSuccess) {
      throw new Error("Failed to navigate to Blinkit search page");
    }

    // 3. Wait for data (either from network or timeout)
    const interceptionResult = await productJsonPromise;

    // Clean up listener
    if (responseHandler) {
      page.off("response", responseHandler);
    }

    // 4. Extract products
    if (interceptionResult.json) {
      console.log("Extracting products from captured JSON response");
      return extractProductInformation(interceptionResult.json);
    } else {
      console.log("JSON interception timed out, no products found");
      return [];
    }

  } catch (error) {
    if (responseHandler) {
      page.off("response", responseHandler);
    }
    console.error(`Error scraping Blinkit products: ${error.message}`);
    throw error;
  }
}

module.exports = {
  ensureContentLoaded,
  extractProductInformation,
  navigateToSearch,
  scrapeProducts
};
