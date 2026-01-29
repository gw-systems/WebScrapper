const ExcelJS = require('exceljs');
const path = require('path');

/**
 * Excel writer utility for progressive category data export
 * Creates/updates a master Excel file with separate sheets for each main category
 */
class CategoryExcelWriter {
    constructor(filePath) {
        this.filePath = filePath;
        this.workbook = null;
        this.initialized = false;
    }

    /**
     * Initialize or load the workbook
     */
    async initialize() {
        const fs = require('fs').promises;
        const fileExists = await fs.access(this.filePath).then(() => true).catch(() => false);

        if (fileExists) {
            // Load existing workbook
            this.workbook = new ExcelJS.Workbook();
            await this.workbook.xlsx.readFile(this.filePath);
            console.log('Loaded existing Excel workbook');
        } else {
            // Create new workbook
            this.workbook = new ExcelJS.Workbook();
            console.log('Created new Excel workbook');
        }

        this.initialized = true;
    }

    /**
     * Add or update a sheet for a main category
     * @param {string} mainCategoryName - Name of the main category
     * @param {Array} products - Array of product objects
     */
    async addMainCategorySheet(mainCategoryName, products) {
        if (!this.initialized) {
            await this.initialize();
        }

        // Sanitize sheet name (Excel has restrictions)
        const sheetName = this._sanitizeSheetName(mainCategoryName);

        // Remove existing sheet if it exists
        const existingSheet = this.workbook.getWorksheet(sheetName);
        if (existingSheet) {
            this.workbook.removeWorksheet(existingSheet.id);
            console.log(`Removed existing sheet: ${sheetName}`);
        }

        // Create new worksheet
        const worksheet = this.workbook.addWorksheet(sheetName);

        // Define columns
        worksheet.columns = [
            { header: 'Category', key: 'category', width: 30 },
            { header: 'Main Category', key: 'mainCategory', width: 25 },
            { header: 'Sub Category', key: 'subCategory', width: 25 },
            { header: 'Brand', key: 'brand', width: 25 },
            { header: 'Product Name', key: 'name', width: 50 },
            { header: 'Price', key: 'price', width: 12 },
            { header: 'Quantity', key: 'quantity', width: 20 },
            { header: 'Rating', key: 'rating', width: 12 },
            { header: 'Image URL', key: 'imageUrl', width: 60 },
            { header: 'Available', key: 'available', width: 12 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Add product rows
        if (products && products.length > 0) {
            products.forEach(product => {
                worksheet.addRow({
                    category: product.category || '',
                    mainCategory: product.mainCategory || '',
                    subCategory: product.subCategory || '',
                    brand: product.brand || 'Unknown',
                    name: product.name || '',
                    price: product.price || '',
                    quantity: product.quantity || '',
                    rating: product.rating || '',
                    imageUrl: product.imageUrl || '',
                    available: product.available ? 'Yes' : 'No'
                });
            });
        } else {
            // Add a row indicating no products
            worksheet.addRow({
                category: mainCategoryName,
                mainCategory: mainCategoryName,
                subCategory: '',
                brand: '',
                name: 'No products found',
                price: '',
                quantity: '',
                rating: '',
                imageUrl: '',
                available: ''
            });
        }

        console.log(`Added sheet "${sheetName}" with ${products.length} products`);
    }

    /**
     * Save the workbook to file
     */
    async save() {
        if (!this.initialized || !this.workbook) {
            throw new Error('Workbook not initialized');
        }

        await this.workbook.xlsx.writeFile(this.filePath);
        console.log(`Saved Excel file to: ${this.filePath}`);
    }

    /**
     * Generate a buffer containing all products in a single sheet
     * @param {Array} products - Array of product objects
     * @returns {Promise<Buffer>} Excel file buffer
     */
    async generateExcel(products) {
        const workbook = new ExcelJS.Workbook();
        const sheetName = 'All Products';
        const worksheet = workbook.addWorksheet(sheetName);

        // Define columns
        worksheet.columns = [
            { header: 'Category', key: 'category', width: 30 },
            { header: 'Main Category', key: 'mainCategory', width: 25 },
            { header: 'Sub Category', key: 'subCategory', width: 25 },
            { header: 'Brand', key: 'brand', width: 25 },
            { header: 'Product Name', key: 'name', width: 50 },
            { header: 'Price', key: 'price', width: 12 },
            { header: 'Quantity', key: 'quantity', width: 20 },
            { header: 'Rating', key: 'rating', width: 12 },
            { header: 'Image URL', key: 'imageUrl', width: 60 },
            { header: 'Available', key: 'available', width: 12 }
        ];

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };

        // Add product rows
        if (products && products.length > 0) {
            products.forEach(product => {
                worksheet.addRow({
                    category: product.category || '',
                    mainCategory: product.mainCategory || '',
                    subCategory: product.subCategory || '',
                    brand: product.brand || 'Unknown',
                    name: product.name || '',
                    price: product.price || '',
                    quantity: product.quantity || '',
                    rating: product.rating || '',
                    imageUrl: product.imageUrl || '',
                    available: product.available ? 'Yes' : 'No'
                });
            });
        }

        return await workbook.xlsx.writeBuffer();
    }

    /**
     * Sanitize sheet name to comply with Excel restrictions
     * - Max 31 characters
     * - Cannot contain: : \ / ? * [ ]
     */
    _sanitizeSheetName(name) {
        let sanitized = name
            .replace(/[:\\/\?*\[\]]/g, '-')
            .substring(0, 31);

        return sanitized;
    }

    /**
     * Get list of existing sheet names
     */
    getExistingSheets() {
        if (!this.initialized || !this.workbook) {
            return [];
        }

        return this.workbook.worksheets.map(ws => ws.name);
    }
}

module.exports = CategoryExcelWriter;
