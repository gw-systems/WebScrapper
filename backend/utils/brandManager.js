const fs = require('fs');
const path = require('path');

class TrieNode {
    constructor() {
        this.children = {};
        this.isEndOfBrand = false;
        this.originalName = null;
    }
}

class BrandManager {
    constructor() {
        this.root = new TrieNode();
        this.isLoaded = false;
        this.brandFilePath = path.join(__dirname, '../../database/Unique-Brand-Names.csv');
        // Aliases for prefix normalization: lowercase prefix -> mapped brand
        this.aliases = {
            'a tata product': 'Tata'
        };
    }

    /**
     * Loads brands from the CSV file and populates the Trie
     */
    loadBrands() {
        try {
            if (!fs.existsSync(this.brandFilePath)) {
                console.warn(`Brand file not found: ${this.brandFilePath}`);
                return;
            }

            const content = fs.readFileSync(this.brandFilePath, 'utf8');
            const lines = content.split(/\r?\n/);

            // Skip header if it exists
            const startIndex = lines[0]?.toLowerCase().includes('brand') ? 1 : 0;

            for (let i = startIndex; i < lines.length; i++) {
                const brand = lines[i].trim();
                if (brand) {
                    this.insert(brand);
                }
            }

            this.isLoaded = true;
            console.log(`Loaded ${lines.length - startIndex} brands into Trie.`);
        } catch (error) {
            console.error('Error loading brands:', error);
        }
    }

    /**
     * Resets the Trie and reloads brands from the CSV file
     */
    reload() {
        this.root = new TrieNode();
        this.isLoaded = false;
        this.loadBrands();
    }

    /**
     * Inserts a brand name into the Trie (case-insensitive)
     */
    insert(brand) {
        let node = this.root;
        const normalized = brand.toLowerCase();

        for (const char of normalized) {
            if (!node.children[char]) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
        }
        node.isEndOfBrand = true;
        node.originalName = brand;
    }

    /**
     * Extracts the longest matching brand from the start of a product name
     * @param {string} productName 
     * @returns {string} The matched brand name or "Brand Not Found"
     */
    extractBrand(productName) {
        if (!this.isLoaded) this.loadBrands();

        const normalizedName = productName.toLowerCase().trim();

        // Check aliases first
        for (const [prefix, mappedBrand] of Object.entries(this.aliases)) {
            if (normalizedName.startsWith(prefix)) {
                return mappedBrand;
            }
        }

        let node = this.root;
        let lastMatchedBrand = null;
        let currentMatch = '';

        for (let i = 0; i < normalizedName.length; i++) {
            const char = normalizedName[i];
            if (node.children[char]) {
                node = node.children[char];
                currentMatch += char;
                if (node.isEndOfBrand) {
                    // Check if the match is a full word boundary or end of string
                    const nextChar = normalizedName[i + 1];
                    if (!nextChar || /\s|[^\w]/.test(nextChar)) {
                        lastMatchedBrand = node.originalName;
                    }
                }
            } else {
                break;
            }
        }

        return lastMatchedBrand || "Brand Not Found";
    }

    /**
     * Returns an array of all brands (useful for passing to browser context)
     */
    getAllBrands() {
        if (!this.isLoaded) this.loadBrands();
        const brands = [];

        const traverse = (node) => {
            if (node.isEndOfBrand) {
                brands.push(node.originalName);
            }
            for (const char in node.children) {
                traverse(node.children[char]);
            }
        };

        traverse(this.root);
        return brands;
    }
}

// Singleton instance
const brandManager = new BrandManager();
module.exports = brandManager;
