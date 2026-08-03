const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');
  await page.waitForSelector('input[type="file"]');
  
  // Create a dummy pdf using pdf-lib
  const { PDFDocument, rgb } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const pdfPage = doc.addPage([500, 500]);
  pdfPage.drawText('THIS IS RIGHT SIDE UP', { x: 50, y: 450, size: 30, color: rgb(0,0,0) });
  const bytes = await doc.save();
  fs.writeFileSync('dummy.pdf', bytes);

  const input = await page.$('input[type="file"]');
  await input.uploadFile('dummy.pdf');
  
  await page.waitForSelector('canvas');
  await new Promise(r => setTimeout(r, 2000));
  
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
  console.log("Done");
})();
