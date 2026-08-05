import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist';

// some versions need worker
// pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.mjs';

async function extract() {
  const data = new Uint8Array(fs.readFileSync('sample_pdf.pdf'));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const textContent = await page.getTextContent();
  
  const words = textContent.items.map(i => i.str).filter(s => s.trim().length > 0);
  console.log(`Total PDF.js items: ${textContent.items.length}`);
  
  const nameItem = textContent.items.find(i => i.str.includes('Name'));
  console.log('Name item:', nameItem);
}

extract().catch(console.error);
