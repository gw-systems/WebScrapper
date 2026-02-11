const express = require('express');
const router = express.Router();
const CategoryExcelWriter = require('../excelWriter');
const logger = require('../utils/logger');

// POST /api/export/excel
router.post('/excel', async (req, res) => {
    try {
        const { products, filename } = req.body;

        if (!products || !Array.isArray(products)) {
            return res.status(400).json({ error: 'Invalid products data' });
        }

        logger.info(`Generating Excel export for ${products.length} products`);

        const writer = new CategoryExcelWriter();
        const buffer = await writer.generateExcel(products);

        const safeFilename = (filename || 'products').replace(/[^a-z0-9-_]/gi, '_');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${safeFilename}.xlsx`);

        res.send(buffer);

    } catch (error) {
        logger.error('Error generating Excel export', { error: error.message });
        res.status(500).json({ error: 'Failed to generate Excel file' });
    }
});

module.exports = router;
