const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function extract() {
  const data = new Uint8Array(fs.readFileSync('sample_pdf.pdf'));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const textContent = await page.getTextContent();
  
  const words = textContent.items.map(i => i.str).filter(s => s.trim().length > 0);
  console.log(`Total PDF.js items: ${textContent.items.length}`);
  
  const nameItem = textContent.items.find(i => i.str.includes('Name'));
  console.log('Name item:', nameItem);
  
  const ayushi = textContent.items.filter(i => i.str.includes('Ayushi'));
  console.log('Ayushi items:', ayushi);
}

extract().catch(console.error);
