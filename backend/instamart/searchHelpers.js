async function navigateToSearch(page, searchTerm) {
  console.log(`Directly navigating to Instamart search URL with term: ${searchTerm}`);

  try {
    const encodedSearchTerm = encodeURIComponent(searchTerm);

    // Using the direct Instamart search URL as provided
    console.log(`Going to: https://www.swiggy.com/instamart/search?custom_back=true&query=${encodedSearchTerm}`);
    const response = await page.goto(`https://www.swiggy.com/instamart/search?custom_back=true&query=${encodedSearchTerm}`, {
      waitUntil: 'networkidle2',
      timeout: 50000
    });

    const url = await page.url();
    console.log(`Current page URL: ${url}`);

    // If we ended up on a general search page instead of Instamart-specific search
    if (!url.includes('instamart/search')) {
      try {
        const instamartTabSelector = 'button[data-testid="instamart-tab"], a[href*="instamart"]';
        const hasInstamartTab = await page.$(instamartTabSelector);

        if (hasInstamartTab) {
          await page.click(instamartTabSelector);
          console.log('Clicked Instamart tab');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.log(`Error clicking Instamart tab: ${error.message}`);
      }
    }

    // Make sure we've actually landed on an Instamart page
    const currentUrl = await page.url();
    if (!currentUrl.includes('instamart')) {
      console.log(`Not on Instamart page, trying direct navigation`);
      await page.goto(`https://www.swiggy.com/instamart/search?custom_back=true&query=${encodedSearchTerm}`, {
        waitUntil: 'networkidle2',
        timeout: 300000
      });
    }

    return true;
  } catch (error) {
    console.log(`Error navigating to Instamart search URL: ${error.message}`);
    return false;
  }
}

async function ensureContentLoaded(page) {
  try {
    console.log("Ensuring Instamart content is loaded...");

    try {
      // Check for loading indicators and wait for them to disappear
      const loadingSelector = '.loading, .shimmer, .skeleton, [class*="loading"], [class*="Loader"]';
      const hasLoadingIndicator = await page.$(loadingSelector);

      if (hasLoadingIndicator) {
        console.log("Found loading indicators, waiting for them to disappear");
        await page.waitForSelector(loadingSelector, { hidden: true, timeout: 10000 })
          .catch(e => console.log(`Loading indicators still present after timeout: ${e.message}`));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Wait for product containers based on the HTML structure provided
      console.log("Waiting for product cards to appear");
      const productSelector = '[data-testid="default_container_ux4"], .XjYJe._2_few, ._179Mx';
      await page.waitForSelector(productSelector, {
        timeout: 10000,
        visible: true
      }).catch(e => console.log(`Product cards not found within timeout: ${e.message}`));

      // Check if we successfully loaded product cards
      const productCardCount = await page.evaluate(() => {
        return document.querySelectorAll('[data-testid="default_container_ux4"], .XjYJe._2_few').length;
      });

      console.log(`Found ${productCardCount} product cards on the page`);

      if (productCardCount > 0) {
        // Give the page a moment to fully render all product details
        await new Promise(resolve => setTimeout(resolve, 1500));
        return true;
      }

      // Check for no results message
      const noResultsFound = await page.evaluate(() => {
        const pageText = document.body.innerText;
        return pageText.includes("No results found") ||
          pageText.includes("No matching products") ||
          pageText.includes("Try another search");
      });

      if (noResultsFound) {
        console.log("No results found message detected on page");
        return false;
      }

      return false;
    } catch (error) {
      console.log(`Timeout waiting for content to load: ${error.message}`);

      // Even if we time out, check if there are any product cards
      const anyProductCards = await page.evaluate(() => {
        return document.querySelectorAll('[data-testid="default_container_ux4"], .XjYJe._2_few').length > 0;
      });

      return anyProductCards;
    }
  } catch (error) {
    console.log(`Error ensuring content loaded: ${error.message}`);
    return false;
  }
}

function extractProductInformation(productJsonResponse) {
  try {
    console.log("Extracting Instamart product information...");

    // First try to extract from JSON response if available
    if (productJsonResponse && productJsonResponse.response && productJsonResponse.response.snippets) {
      console.log("Extracting from JSON response...");
      const products = [];
      const productSnippets = productJsonResponse.response.snippets.filter(snippet =>
        snippet.data &&
        snippet.data.identity &&
        snippet.data.identity.id !== "product_container" &&
        snippet.data.name
      );

      for (const snippet of productSnippets) {
        try {
          const productData = snippet.data;

          // Extract product information
          const product = {
            id: productData.identity.id || `instamart_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
            name: productData.name || "Unknown Product",
            price: productData.final_price ? `₹${productData.final_price}` : "Price unavailable",
            originalPrice: productData.price ? `₹${productData.price}` : null,
            savings: productData.price && productData.final_price ?
              `₹${(parseFloat(productData.price) - parseFloat(productData.final_price)).toFixed(2)}` : null,
            quantity: productData.weight || productData.quantity || "1 item",
            deliveryTime: productData.delivery_time || "15-30 mins",
            discount: productData.discount_text || (
              productData.price && productData.final_price ?
                `${Math.round(((parseFloat(productData.price) - parseFloat(productData.final_price)) / parseFloat(productData.price)) * 100)}% OFF` : null
            ),
            imageUrl: productData.image_url || productData.img_url || "",
            available: !productData.out_of_stock,
            source: "instamart"
          };

          products.push(product);
        } catch (error) {
          console.error(`Error processing individual Instamart product:`, error);
          // Continue to next product
        }
      }

      console.log(`Extracted ${products.length} Instamart products from JSON response`);
      if (products.length > 0) {
        return products;
      }
    }

    // Fallback to HTML extraction if JSON extraction failed or returned no products
    return extractProductsFromHTML(productJsonResponse.page);
  } catch (error) {
    console.error("Error extracting Instamart product information:", error);
    if (productJsonResponse && productJsonResponse.page) {
      console.log("Falling back to HTML extraction...");
      return extractProductsFromHTML(productJsonResponse.page);
    }
    return [];
  }
}

// Helper to extract products from JSON-LD
async function extractProductsFromJSONLD(page) {
  try {
    console.log("Attempting JSON-LD extraction...");
    return await page.evaluate(() => {
      try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
          const data = JSON.parse(script.innerText);
          if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
            return data.itemListElement.map(item => ({
              id: `instamart_jsonld_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name: item.name,
              imageUrl: item.image ? (Array.isArray(item.image) ? item.image[0] : item.image) : '',
              price: item.offers ? `₹${item.offers.price}` : "Price unavailable",
              originalPrice: null, // Often not in JSON-LD
              quantity: item.description || "1 item", // Heuristic
              deliveryTime: "15-30 mins",
              available: true,
              source: "instamart_jsonld"
            }));
          }
        }
      } catch (e) {
        console.error("JSON-LD extraction failed inside evaluate", e);
      }
      return [];
    });
  } catch (error) {
    console.error("Error in JSON-LD extraction:", error);
    return [];
  }
}

// Helper for heuristic DOM extraction (fuzzy matching)
async function extractProductsHeuristic(page) {
  try {
    console.log("Attempting heuristic DOM extraction...");
    return await page.evaluate(() => {
      const items = [];
      const imgs = document.querySelectorAll('img');
      const processedContainers = new Set();

      imgs.forEach(img => {
        // Walk up to find a container with Price
        let container = img.parentElement;
        let foundPrice = false;
        let priceVal = '';
        let nameVal = '';

        // Limit depth
        for (let i = 0; i < 8; i++) {
          if (!container) break;

          const text = container.innerText || '';
          // Look for Rupee symbol
          if (text.includes('₹')) {
            const priceMatch = text.match(/₹\s*(\d+)/);
            if (priceMatch) {
              priceVal = `₹${priceMatch[1]}`;
              foundPrice = true;

              const lines = text.split('\n').map(l => l.trim()).filter(l => l);
              // Heuristic: Name is usually the first meaningful line that isn't a badge
              // This is a best-effort guess
              if (lines.length > 0) {
                // Skip common UI words if they appear first
                const skipWords = ["ADD", "OFF", "%", "₹"];
                nameVal = lines.find(l => !skipWords.some(w => l.includes(w))) || lines[0];
              }
              break;
            }
          }
          container = container.parentElement;
        }

        if (foundPrice && container && !processedContainers.has(container)) {
          processedContainers.add(container);

          // Try to find quantity (e.g. 500 g, 1 kg)
          const qtyMatch = container.innerText.match(/(\d+\s*(?:g|kg|ml|l|pcs|pc))/i);
          const quantity = qtyMatch ? qtyMatch[1] : '1 item';

          // Try to find original price
          // Often looks like ₹100 inside a slightly different style or strike-through checks (hard to detect styles here)
          // We'll leave originalPrice null for heuristic

          items.push({
            id: `instamart_heuristic_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: nameVal || "Unknown Product",
            price: priceVal,
            originalPrice: null,
            quantity: quantity,
            deliveryTime: "15-30 mins",
            imageUrl: img.src,
            available: true,
            source: "instamart_heuristic"
          });
        }
      });
      return items;
    });
  } catch (error) {
    console.error("Error in heuristic extraction:", error);
    return [];
  }
}

// Helper function to extract products from HTML structure
async function extractProductsFromHTML(page) {
  try {
    console.log("Extracting Instamart products from HTML structure...");

    // Strategy 1: JSON-LD (High fidelity)
    const jsonLdProducts = await extractProductsFromJSONLD(page);
    if (jsonLdProducts.length > 0) {
      console.log(`Found ${jsonLdProducts.length} products via JSON-LD`);
      return jsonLdProducts;
    }

    // Strategy 2: Specific Selectors (Legacy/Current)
    const products = await page.evaluate(() => {
      const productCards = Array.from(document.querySelectorAll('[data-testid="default_container_ux4"], .XjYJe._2_few, ._179Mx'));
      console.log(`Found ${productCards.length} product cards on the page via selectors`);

      return productCards.map(card => {
        try {
          // Generate a unique ID
          const id = `instamart_html_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

          // Get product name
          const nameElement = card.querySelector('.novMV') || card.querySelector('.sc-aXZVg.kyEzVU') || card.querySelector('[data-testid="item-name"]');
          const name = nameElement ? nameElement.textContent.trim() : "Unknown Product";

          // Get current price
          const priceElement = card.querySelector('[data-testid="item-offer-price"]');
          const price = priceElement ? `₹${priceElement.textContent.trim()}` : "Price unavailable";

          // Get original price if available
          const originalPriceElement = card.querySelector('[data-testid="item-mrp-price"]');
          const originalPrice = originalPriceElement ? `₹${originalPriceElement.textContent.trim()}` : null;

          // Get discount/savings if available
          const discountElement = card.querySelector('[data-testid="item-offer-label-discount-text"]');
          const discount = discountElement ? discountElement.textContent.trim() : null;

          // Get quantity/weight
          const weightElement = card.querySelector('._3eIPt') || card.querySelector('.sc-aXZVg.entQHA');
          const quantity = weightElement ? weightElement.textContent.split('chevronDownIcon')[0].trim() : "1 item";

          // Get image URL
          const imageElement = card.querySelector('img.sc-dcJsrY') || card.querySelector('._1NxA5') || card.querySelector('.tPMI1') || card.querySelector('img');
          const imageUrl = imageElement ? imageElement.getAttribute('src') : "";

          // Check availability
          const soldOutElement = card.querySelector('[data-testid="sold-out"]');
          const available = !soldOutElement;

          // Calculate savings
          let savings = null;
          if (price && originalPrice) {
            const priceValue = parseFloat(price.replace('₹', '').trim());
            const originalPriceValue = parseFloat(originalPrice.replace('₹', '').trim());
            if (!isNaN(priceValue) && !isNaN(originalPriceValue)) {
              savings = `₹${(originalPriceValue - priceValue).toFixed(2)}`;
            }
          }

          return {
            id,
            name,
            price,
            originalPrice,
            savings,
            quantity,
            deliveryTime: "10 mins",
            discount,
            description: null,
            imageUrl,
            available,
            source: "instamart"
          };
        } catch (err) {
          console.error("Error extracting product data:", err);
          return null;
        }
      }).filter(product => product !== null);
    });

    if (products.length > 0) {
      console.log(`Extracted ${products.length} products from HTML selectors`);
      return products;
    }

    // Strategy 3: Heuristic (Fallback)
    console.log("Selectors returned 0 products, attempting heuristic extraction...");
    const heuristicProducts = await extractProductsHeuristic(page);
    console.log(`Extracted ${heuristicProducts.length} products via heuristic method`);
    return heuristicProducts;

  } catch (error) {
    console.error("Error extracting products from HTML:", error);
    return [];
  }
}


/**
 * Orchestrates product scraping for a search term
 */
async function scrapeProducts(page, term) {
  console.log(`Starting Instamart search for: ${term}`);

  let responseHandler = null;

  try {
    // 1. Setup response interception for JSON API
    // Create a promise that resolves when we get the API response
    const productJsonPromise = new Promise((resolve) => {
      responseHandler = async (response) => {
        const url = response.url();
        const type = response.request().resourceType();

        if (type === "xhr" || type === "fetch") {
          try {
            // Check for product data format
            if (url.includes("instamart/search") || url.includes("search/search")) {
              const json = await response.json().catch(() => null);

              // Check if this looks like a search response with products
              // Instamart responses can be complex, looking for snippets or specific widget types
              if (json && json.data && (
                (json.data.widgets) ||
                (json.data.products) ||
                (json.response && json.response.snippets) // Matching what was in extractProductInformation
              )) {
                console.log(`Captured Instamart product JSON from: ${url}`);
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

    // 2. Navigate
    const navigationSuccess = await navigateToSearch(page, term);

    if (!navigationSuccess) {
      throw new Error("Failed to navigate to search page");
    }

    // 3. Wait for data 
    // We wait for either the JSON response OR the content to be loaded in DOM
    const dataLoadRace = Promise.race([
      productJsonPromise,
      ensureContentLoaded(page).then(success => ({ domLoaded: success }))
    ]);

    const result = await dataLoadRace;

    // Clean up listener
    if (responseHandler) {
      page.off("response", responseHandler);
    }

    // 4. Extract
    // If we caught JSON, try that first
    if (result.json) {
      const products = extractProductInformation(result.json);
      if (products.length > 0) return products;
    }

    // Fallback to HTML extraction
    console.log("Using HTML extraction as primary or fallback");
    return await extractProductsFromHTML(page);

  } catch (error) {
    if (responseHandler) {
      page.off("response", responseHandler);
    }
    console.error(`Error scraping Instamart products: ${error.message}`);
    throw error;
  }
}

module.exports = {
  navigateToSearch,
  ensureContentLoaded,
  extractProductInformation,
  extractProductsFromHTML,
  scrapeProducts
};
