import * as XLSX from "xlsx";
import type { Service, CategoryScrapeResult } from '../types';
import { toast } from 'react-hot-toast';

export const downloadCategoryExcel = (
    service: Service,
    categoryResults: CategoryScrapeResult[],
    categorySearchTerm: string
) => {
    if (categoryResults.length === 0) {
        toast.error("No scraped data to download");
        return;
    }

    // Flatten all products from all category results
    const allProducts: any[] = [];
    categoryResults.forEach(categoryResult => {
        if (categoryResult.products && categoryResult.products.length > 0) {
            categoryResult.products.forEach((product: any) => {
                allProducts.push({
                    'Category': product.category || categoryResult.category || 'Unknown',
                    'Main Category': product.mainCategory || 'Unknown',
                    'Sub Category': product.subCategory || 'Unknown',
                    'Brand': product.brand || 'Unknown',
                    'Product Name': product.name || product.productName || 'Unknown',
                    'Price': product.price || 'N/A',
                    'Quantity': product.quantity || 'N/A',
                    'Rating': product.rating || 'N/A',
                    'Image URL': product.imageUrl || product.image || 'N/A',
                    'Available': product.available ? 'Yes' : 'No'
                });
            });
        }
    });

    if (allProducts.length === 0) {
        toast.error("No products found in scraped data");
        return;
    }

    const wb = XLSX.utils.book_new();

    // If search term was used -> Single sheet
    // If "Scrape ALL" -> Multi-sheet by main category
    if (categorySearchTerm && categorySearchTerm.trim() !== "") {
        // Single sheet for search results
        const ws = XLSX.utils.json_to_sheet(allProducts);

        // Set column widths
        ws['!cols'] = [
            { wch: 25 }, // Category
            { wch: 25 }, // Main Category
            { wch: 25 }, // Sub Category
            { wch: 20 }, // Brand
            { wch: 50 }, // Product Name
            { wch: 12 }, // Price
            { wch: 20 }, // Quantity
            { wch: 12 }, // Rating
            { wch: 60 }, // Image URL
            { wch: 12 }  // Available
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Search Results");

    } else {
        // Multi-sheet by main category (for "Scrape ALL")

        // Group products by main category
        const grouped: Record<string, any[]> = {};
        allProducts.forEach(product => {
            const mainCat = product['Main Category'];
            if (!grouped[mainCat]) {
                grouped[mainCat] = [];
            }
            grouped[mainCat].push(product);
        });

        // Create a sheet for each main category
        Object.keys(grouped).forEach(mainCat => {
            const ws = XLSX.utils.json_to_sheet(grouped[mainCat]);

            // Set column widths
            ws['!cols'] = [
                { wch: 25 }, // Category
                { wch: 25 }, // Main Category
                { wch: 25 }, // Sub Category
                { wch: 20 }, // Brand
                { wch: 50 }, // Product Name
                { wch: 12 }, // Price
                { wch: 20 }, // Quantity
                { wch: 12 }, // Rating
                { wch: 60 }, // Image URL
                { wch: 12 }  // Available
            ];

            // Sanitize sheet name (Excel has 31 char limit and special char restrictions)
            const sheetName = mainCat
                .replace(/[:\\/?*[\]]/g, '-') // Replace invalid chars
                .substring(0, 31); // Limit to 31 chars

            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = categorySearchTerm
        ? `${service}-search-${categorySearchTerm}-${timestamp}.xlsx`
        : `${service}-all-categories-${timestamp}.xlsx`;

    // Download
    XLSX.writeFile(wb, fileName);

    toast.success('Excel file downloaded!', { icon: '📥' });
};
