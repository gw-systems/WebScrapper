const http = require('http');
const express = require('express');
const instamartRoutes = require('./routes/instamart');

// Setup minimal server for testing
const app = express();
app.use(express.json());
app.use('/api/instamart', instamartRoutes);

const PORT = 5001;
const server = app.listen(PORT, async () => {
    console.log(`Test server running on port ${PORT}`);

    try {
        // 1. Test Categories
        console.log('Testing /api/instamart/categories...');
        const categoriesRes = await fetch(`http://localhost:${PORT}/api/instamart/categories`);
        const categories = await categoriesRes.json();
        console.log(`Response Status: ${categoriesRes.status}`);
        console.log(`Success: ${categories.success}`);
        if (categories.data) {
            console.log(`Categories found: ${categories.data.length}`);
            console.log('Sample:', categories.data[0]);
        }

        // 2. Test Products
        console.log('\nTesting /api/instamart/products?limit=1...');
        const productsRes = await fetch(`http://localhost:${PORT}/api/instamart/products?limit=1`);
        const products = await productsRes.json();
        console.log(`Response Status: ${productsRes.status}`);
        console.log(`Success: ${products.success}`);
        if (products.data) {
            console.log(`Products found: ${products.data.length}`);
            console.log('Sample:', products.data[0].name);
        }

        console.log('\n✅ API Tests Passed');

    } catch (error) {
        console.error('❌ API Test Failed:', error);
    } finally {
        server.close();
        process.exit(0);
    }
});
