const brandManager = require('./utils/brandManager');

const testCases = [
    "Amul Butter 500g",
    "Mother Dairy Full Cream Milk 1L",
    "24 Mantra Organic Poha 500g",
    "Aashirvaad Atta 5kg",
    "Unknown Brand Product 100g",
    "Amulya Dairy Whitener",
    "Dabur Honey 250g",
    "Daily Good Almonds",
    "Borges Olive Oil",
    "Pee Safe Toilet Seat Sanitizer Spray",
    "A TATA Product Sampann Toor Dal",
    "Chandan Calcutta Mitha Pan Mouth Freshener"
];

console.log("--- Testing Brand Extraction ---");
testCases.forEach(name => {
    const brand = brandManager.extractBrand(name);
    console.log(`Product: "${name}" => Brand: "${brand}"`);
});
