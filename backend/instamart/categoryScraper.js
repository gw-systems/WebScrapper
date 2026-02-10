const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const path = require('path');
const fs = require('fs');

/**
 * Fetches all Instamart categories from the sitemap
 * @returns {Promise<Array>} Array of category objects
 */
async function getAllCategories(excludedCategories = []) {
    try {
        console.log('Fetching Instamart categories from sitemap...');

        const localJsonPath = path.resolve(__dirname, '../../scraped_data/instamart_full_categories.json');
        if (fs.existsSync(localJsonPath)) {
            console.log('Using local category JSON as source of truth.');
            const rawData = fs.readFileSync(localJsonPath, 'utf8');
            const data = JSON.parse(rawData);

            const uniqueCategories = data.map(cat => ({
                name: cat.name,
                url: cat.url || (cat.exampleLink ? `https://www.swiggy.com${cat.exampleLink}` : '')
            })).filter(cat => cat.url);

            const excludedLower = excludedCategories.map(c => c.toLowerCase().trim());
            return uniqueCategories.filter(cat =>
                !excludedLower.some(ex => cat.name.toLowerCase().includes(ex))
            );
        }

        return [];
    } catch (error) {
        console.error('Error fetching Instamart categories:', error.message);
        return [];
    }
}

/**
 * Handles "Something went wrong" error pages on Instamart
 * @param {Object} page - Puppeteer page object
 */
async function handleErrorPages(page) {
    try {
        const errorDetected = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, span, div'));
            const retryBtn = buttons.find(b => {
                const text = b.innerText.toLowerCase();
                return (text.includes('try again') || text.includes('retry')) && b.offsetWidth > 0;
            });

            if (retryBtn) {
                retryBtn.click();
                return true;
            }

            const bodyText = document.body.innerText;
            if (bodyText.includes('Something went wrong') || bodyText.includes('failed to load')) {
                window.location.reload();
                return true;
            }
            return false;
        });

        if (errorDetected) {
            console.log('[Instamart] Error page detected and handled. Waiting for recovery...');
            await new Promise(r => setTimeout(r, 5000));
            return true;
        }
    } catch (e) {
        // Evaluate might fail if page is loading
    }
    return false;
}

/**
 * Sets location using UI interactions
 * @param {Object} page - Puppeteer page object
 * @param {string} locationName - Name of the location (e.g., 'Mumbai Central')
 */
async function setLocationUI(page, locationName) {
    console.log(`[Instamart] Setting location via UI: ${locationName}`);

    try {
        await page.goto('https://www.swiggy.com/instamart', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Handle initial error if any
        await handleErrorPages(page);

        // Check if "Share location" modal is already present
        const modalInput = await page.evaluate(() => {
            const input = document.querySelector('input[placeholder*="Search"], ._1wkJd');
            if (input && input.closest('.zU41J, .sc-')) return true; // Check if in a modal-like container
            return false;
        });

        if (!modalInput) {
            // Click location selector (top-left) if modal not open
            const selector = '[data-testid="address-bar"], [data-testid="address-line"], ._3FN4I, ._3eFQ-';
            console.log(`[Instamart] Waiting for selector: ${selector}`);
            await page.waitForSelector(selector, { timeout: 15000 }).catch(() => null);

            // If the above failed, try clicking any element with "Add your location" text via XPath
            const clicked = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('div, span, button'));
                const el = elements.find(e => e.innerText.includes('Add your location') && e.offsetWidth > 0);
                if (el) { el.click(); return true; }
                const addressBar = document.querySelector('[data-testid="address-bar"]');
                if (addressBar) { addressBar.click(); return true; }
                return false;
            });

            if (clicked) {
                console.log('[Instamart] Location selector interactions initiated.');
            }
            await new Promise(r => setTimeout(r, 2000));
        } else {
            console.log('[Instamart] Location modal already open.');
        }

        // Type location in search input
        console.log(`[Instamart] Looking for location input...`);
        const typed = await page.evaluate((loc) => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const input = inputs.find(i =>
                (i.placeholder && i.placeholder.toLowerCase().includes('area or address')) ||
                (i.className && i.className.includes('_1wkJd'))
            );
            if (input) {
                input.focus();
                input.value = ''; // Clear it
                return true;
            }
            return false;
        }, locationName);

        if (typed) {
            await page.keyboard.type(locationName, { delay: 150 });
            console.log(`[Instamart] Typed location via keyboard.`);
        } else {
            console.log('[Instamart] Warning: Could not find location input to type.');
            // Fallback: try the known selector
            const inputSelector = 'input[placeholder*="area or address"], ._1wkJd';
            await page.type(inputSelector, locationName, { delay: 150 }).catch(() => null);
        }
        await new Promise(r => setTimeout(r, 3000));

        // Select first suggestion from the dropdown
        const selected = await page.evaluate(() => {
            const suggestions = document.querySelectorAll('div._11n32, div._2esgM, ._3as74');
            if (suggestions.length > 0) {
                suggestions[0].click();
                return true;
            }
            return false;
        });

        if (!selected) {
            console.log('[Instamart] No suggestions found, trying Enter key...');
            await page.keyboard.press('Enter');
        }

        await new Promise(r => setTimeout(r, 3000));

        // Click Confirm/Set Location button
        console.log('[Instamart] Clicking confirm button...');
        const confirmed = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, span, div'));
            const confirmBtn = buttons.find(b => {
                const text = b.innerText.toLowerCase();
                return (text.includes('confirm') || text.includes('set location')) && b.offsetWidth > 0;
            });
            if (confirmBtn) {
                confirmBtn.click();
                return true;
            }
            return false;
        });

        if (!confirmed) console.log('[Instamart] Warning: Confirm button not clicked via JS.');

        console.log('[Instamart] Finalizing location confirmation...');
        await new Promise(r => setTimeout(r, 5000));
        await handleErrorPages(page);

        return true;
    } catch (error) {
        console.error('[Instamart] Failed to set location via UI:', error.message);
        return false;
    }
}

/**
 * Scrapes products from a category page using infinite scroll
 */
async function scrapeCategoryProducts(page, categoryUrl) {
    console.log(`[Instamart] Scraping category: ${categoryUrl}`);

    try {
        await page.goto(categoryUrl, {
            waitUntil: 'networkidle2',
            timeout: 90000
        });

        await handleErrorPages(page);

        // Infinite Scroll to load all products
        console.log('[Instamart] Starting infinite scroll...');
        let previousCount = 0;
        let sameCountCycles = 0;
        const maxScrollCycles = 20;

        for (let i = 0; i < maxScrollCycles; i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await new Promise(r => setTimeout(r, 3000));

            // Handle mid-scroll errors
            const wasError = await handleErrorPages(page);
            if (wasError) await new Promise(r => setTimeout(r, 2000));

            const currentCount = await page.evaluate(() =>
                document.querySelectorAll('[data-testid="item-card"], [data-testid="item-collection-card-full"]').length
            );

            console.log(`[Instamart] Loaded ${currentCount} products...`);

            if (currentCount > 0 && currentCount === previousCount) {
                sameCountCycles++;
                if (sameCountCycles >= 3) {
                    console.log('[Instamart] Reached end of category.');
                    break;
                }
            } else {
                sameCountCycles = 0;
            }
            previousCount = currentCount;

            if (currentCount > 800) break; // Hard cap
        }

        // Extract products using the researched selectors
        const products = await page.evaluate(() => {
            const results = [];
            const cards = document.querySelectorAll('[data-testid="item-card"], [data-testid="item-collection-card-full"]');

            cards.forEach(card => {
                try {
                    // Name extraction
                    const nameEl = card.querySelector('.iPErou, ._1lbNR, [class*="itemName"], ._2fz9L') || card.querySelector('img');
                    const name = nameEl ? (nameEl.innerText || nameEl.getAttribute('alt')) : 'Unknown';

                    if (name === 'Unknown' || !name) return;

                    // Image
                    const imgEl = card.querySelector('img');
                    const imageUrl = imgEl ? imgEl.src : '';

                    // Refined Price and MRP parsing
                    // Instamart uses specific containers for prices. 
                    const priceContainer = card.querySelector('._2enD-, [class*="price"], [class*="Price"], ._2fz9L');
                    let price = 'N/A';
                    let mrp = 'N/A';

                    if (priceContainer) {
                        const priceElements = Array.from(priceContainer.querySelectorAll('div, span'))
                            .filter(el => el.children.length === 0 && el.innerText.trim().match(/^\d+$/));

                        if (priceElements.length > 0) {
                            price = `₹${priceElements[0].innerText.trim()}`;
                            mrp = priceElements.length >= 2 ? `₹${priceElements[1].innerText.trim()}` : price;
                        }
                    }

                    // Fallback: Broad numeric search if container method failed
                    if (price === 'N/A') {
                        // Get all numbers from the card text, filtering out common quantity numbers (like 1, 2, 5, 10, 100, 250, 500) 
                        // if they lack price context. 
                        // Better: just look for numbers that follow a ₹ or are in price blocks.
                        const matches = card.innerText.match(/₹?\s*(\d+)/g);
                        if (matches) {
                            const found = matches.map(m => m.replace(/[^\d]/g, '')).filter(m => m.length > 0);
                            if (found.length > 0) {
                                price = `₹${found[0]}`;
                                mrp = found.length > 1 ? `₹${found[found.length - 1]}` : price;
                            }
                        }
                    }

                    // Secondary fallback: Any number > 9 that isn't a known quantity pattern
                    if (price === 'N/A') {
                        const allNumbers = card.innerText.match(/\d+/g);
                        if (allNumbers) {
                            const plausible = allNumbers.filter(n => parseInt(n) > 5);
                            if (plausible.length > 0) {
                                price = `₹${plausible[0]}`;
                                mrp = plausible.length > 1 ? `₹${plausible[plausible.length - 1]}` : price;
                            }
                        }
                    }

                    // Quantity/Weight
                    const qtyEl = card.querySelector('.sc-gEvEer, ._3eIPt, .entQHA, ._2S6pG');
                    let quantity = '1 item';
                    if (qtyEl) {
                        const qText = qtyEl.innerText;
                        if (!qText.includes('MINS') && !qText.includes('SOLD OUT') && !qText.includes('AD')) {
                            quantity = qText;
                        } else {
                            const weightEl = Array.from(card.querySelectorAll('div, span')).find(el =>
                                el.innerText.match(/\d+\s*(g|kg|ml|l|unit|pc|pkt)/i)
                            );
                            if (weightEl) quantity = weightEl.innerText;
                        }
                    }

                    // Availability
                    const hasAddButton = card.querySelector('[data-testid="buttonpair-add"], ._2fz9L') !== null;
                    const isSoldOut = card.innerText.toLowerCase().includes('out of stock') ||
                        card.innerText.toLowerCase().includes('sold out');

                    results.push({
                        id: `instamart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                        name: name.trim(),
                        price,
                        mrp,
                        quantity: quantity.split('chevronDownIcon')[0].trim(),
                        imageUrl,
                        available: hasAddButton && !isSoldOut,
                        source: 'instamart'
                    });
                } catch (e) { }
            });
            return results;
        });

        console.log(`[Instamart] Extraction complete. Found ${products.length} products.`);
        return products;

    } catch (error) {
        console.error(`[Instamart] Error scraping category ${categoryUrl}:`, error.message);
        return [];
    }
}

module.exports = {
    getAllCategories,
    setLocationUI,
    scrapeCategoryProducts,
    handleErrorPages
};
