// Script to convert CSV sample to Excel format
// Run: node scripts/create_sample_excel.js

const XLSX = require('xlsx');
const fs = require('fs');

console.log('📝 Creating sample Excel file...');

// Read the CSV file
const csvContent = fs.readFileSync('docs/sample_exam_bank.csv', 'utf-8');

// Convert CSV to worksheet
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(
  csvContent.split('\n').map(line => {
    // Parse CSV line (simple approach)
    const parts = line.split(',');
    return parts;
  })
);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Question Bank');

// Write to file
const outputPath = 'docs/sample_exam_bank.xlsx';
XLSX.writeFile(workbook, outputPath);

console.log('✅ Sample Excel file created at:', outputPath);
console.log('📄 You can now upload this file to the Exam Bank system!');

