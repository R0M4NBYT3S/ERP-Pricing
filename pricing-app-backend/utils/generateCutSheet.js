const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function generateCutSheet(orderData) {
  // Ensure /data folder exists
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created /data folder automatically.');
  }

  // Create workbook and sheet
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Cut Sheet');

  // Add headers
  sheet.addRow(['Product', 'Length', 'Width', 'Skirt', 'Metal', 'Price']);

  // Add the actual order data
  sheet.addRow([
    orderData.product || '',
    orderData.length || '',
    orderData.width || '',
    orderData.skirt || '',
    orderData.metalType || '',
    orderData.final_price || ''
  ]);

  // Auto-fit column widths
  sheet.columns.forEach(col => { col.width = 15; });

  // Save file with timestamp
  const fileName = `cut-sheet-${Date.now()}.xlsx`;
  const filePath = path.join(dataDir, fileName);
  await workbook.xlsx.writeFile(filePath);

  console.log(`✅ Cut sheet generated: ${filePath}`);
  return fileName;
}

module.exports = generateCutSheet;
