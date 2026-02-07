const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Adapter to run the Python Instamart Scraper from Node.js
 */
class PythonScraperAdapter {

    /**
     * Scrape a category using the Python script
     * @param {object} page - Puppeteer page object (for extracting cookies)
     * @param {string} categoryName - Category to scrape
     * @param {string} location - Location string (optional, for logging)
     * @returns {Promise<Array>} List of products
     */
    static async scrapeCategory(page, categoryName, location) {
        console.log(`[PythonAdapter] Preparing to scrape "${categoryName}" via Python...`);

        try {
            // 1. Extract Cookies & Store ID from Page
            const { cookieString, storeId, userAgent } = await this.extractSessionData(page);

            if (!cookieString || !storeId) {
                throw new Error("Failed to extract Instamart session (cookies/storeId) from browser");
            }

            console.log(`[PythonAdapter] Extracted Store ID: ${storeId}`);
            console.log(`[PythonAdapter] Extracted User-Agent (Full): ${userAgent}`);

            // Debug Viewport
            const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
            console.log(`[PythonAdapter] Viewport: ${viewport.width}x${viewport.height}`);

            // 2. Run Python Script
            const jsonFilePath = await this.runPythonScript(categoryName, cookieString, storeId, userAgent);

            // 3. Read Results
            if (!fs.existsSync(jsonFilePath)) {
                throw new Error(`Output file not found: ${jsonFilePath}`);
            }

            const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
            const data = JSON.parse(fileContent);

            // 4. Return products
            return data.products || [];

        } catch (error) {
            console.error('[PythonAdapter] Error:', error.message);
            throw error;
        }
    }

    /**
     * Extract cookies and store ID from the Puppeteer page
     * Method: Intercept outgoing API requests to capture valid headers and payload
     */
    static async extractSessionData(page) {
        let capturedStoreId = null;
        let capturedCookie = null;
        const userAgent = await page.browser().userAgent();

        // 1. Setup Request Interception
        // We look for calls to 'instamart/home', 'cart', or similar which carry storeId
        const requestHandler = (request) => {
            const url = request.url();

            // Check for API calls that likely contain the storeId
            if (url.includes('swiggy.com/api/instamart/home') ||
                url.includes('swiggy.com/api/instamart/category-listing')) {

                // A. Extract Store ID from URL params
                if (url.includes('storeId=')) {
                    const match = url.match(/storeId=([^&]+)/);
                    if (match && !capturedStoreId) {
                        capturedStoreId = match[1];
                        console.log(`[PythonAdapter] Intercepted Store ID from URL: ${capturedStoreId}`);
                    }
                }

                // B. Extract Cookies from Headers
                const headers = request.headers();
                if (headers['cookie'] && !capturedCookie) {
                    capturedCookie = headers['cookie'];
                    console.log('[PythonAdapter] Intercepted Request Cookies');
                }
            }
        };

        page.on('request', requestHandler);

        // 2. Ensure we are on Swiggy Instamart and Trigger Traffic
        const currentUrl = page.url();
        console.log(`[PythonAdapter] Current URL: ${currentUrl}`);

        if (!currentUrl.includes('swiggy.com/instamart')) {
            console.log('[PythonAdapter] Navigating to Instamart...');
            await page.goto('https://www.swiggy.com/instamart', {
                waitUntil: 'networkidle2', // Wait for network to be idle (scripts loaded)
                timeout: 30000
            });
        } else {
            // If already on page, maybe reload to trigger requests?
            // Or better: scroll or interact to trigger an API call if needed
            console.log('[PythonAdapter] Already on Instamart, refreshing to trigger network requests...');
            await page.reload({ waitUntil: 'networkidle2' });
        }

        // 3. Wait for capture (max 10 seconds)
        const maxWait = 10000;
        const start = Date.now();
        while ((!capturedStoreId || !capturedCookie) && (Date.now() - start < maxWait)) {
            await new Promise(r => setTimeout(r, 500));
        }

        // Remove listener
        page.off('request', requestHandler);

        // 4. Fallback if interception failed (try DOM/Cookies)
        if (!capturedStoreId || !capturedCookie) {
            console.log('[PythonAdapter] Network interception partial/failed, trying DOM fallback...');
            const domData = await this.extractSessionDataFallback(page);
            if (!capturedStoreId) capturedStoreId = domData.storeId;
            if (!capturedCookie) capturedCookie = domData.cookieString;
        }

        if (!capturedStoreId) {
            console.warn('[PythonAdapter] Store ID extraction failed.');
            // Screenshot for debug
            try {
                const screenshotPath = path.resolve(__dirname, '../../logs/session_fail.png');
                await page.screenshot({ path: screenshotPath });
                console.log(`[DEBUG] Screenshot saved to: ${screenshotPath}`);
            } catch (e) { }
        }

        return { cookieString: capturedCookie, storeId: capturedStoreId, userAgent };
    }

    /**
     * Fallback: Extract cookies and store ID from DOM/Storage
     */
    static async extractSessionDataFallback(page) {
        // Get cookies
        const cookies = await page.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        // Get store ID
        const storeId = await page.evaluate(() => {
            try {
                // 1. Try localStorage
                const locData = localStorage.getItem('userLocation');
                if (locData) {
                    const parsed = JSON.parse(locData);
                    if (parsed.storeId) return parsed.storeId;
                }

                // 2. Try Cookies (storeId param)
                const cookieMatch = document.cookie.match(/storeId=([^;]+)/);
                if (cookieMatch) return cookieMatch[1];

                // 3. Try Cookies (userLocation param - url encoded json)
                const userLocMatch = document.cookie.match(/userLocation=([^;]+)/);
                if (userLocMatch) {
                    try {
                        const decoded = decodeURIComponent(userLocMatch[1]);
                        const parsed = JSON.parse(decoded);
                        if (parsed.storeId) return parsed.storeId;
                    } catch (e) { }
                }

                return null;
            } catch (e) {
                return null;
            }
        });

        return { cookieString, storeId };
    }

    /**
     * Spawn Python process
     */
    static runPythonScript(categoryName, cookieString, storeId, userAgent) {
        return new Promise((resolve, reject) => {
            const scriptPath = path.resolve(__dirname, 'api_scraper.py');
            const args = [
                scriptPath,
                '--category', categoryName,
                '--cookie', cookieString,
                '--store', storeId
            ];

            if (userAgent) {
                args.push('--user-agent', userAgent);
            }

            const pythonProcess = spawn('python', args);

            let outputBuffer = '';
            let errorBuffer = '';
            let jsonFilePath = null;

            pythonProcess.stdout.on('data', (data) => {
                const text = data.toString();
                outputBuffer += text;
                console.log(`[Python] ${text.trim()}`);

                // Check for result marker
                if (text.includes('__JSON_RESULT__:')) {
                    const match = text.match(/__JSON_RESULT__:(.+)/);
                    if (match) {
                        jsonFilePath = match[1].trim();
                    }
                }
            });

            pythonProcess.stderr.on('data', (data) => {
                errorBuffer += data.toString();
                console.error(`[Python stderr] ${data.toString().trim()}`);
            });

            pythonProcess.on('error', (err) => {
                reject(new Error(`Failed to start Python process: ${err.message}`));
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python script exited with code ${code}. Error: ${errorBuffer}`));
                } else if (!jsonFilePath) {
                    // Try to finding it from output log if marker missed (fallback)
                    // e.g. "💾 Saved to: ..."
                    const match = outputBuffer.match(/💾 Saved to: (.+json)/);
                    if (match) {
                        resolve(match[1].trim());
                    } else {
                        reject(new Error('Python script finished but did not return output file path'));
                    }
                } else {
                    resolve(jsonFilePath);
                }
            });
        });
    }
}

module.exports = PythonScraperAdapter;
