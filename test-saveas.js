import puppeteer from 'puppeteer';
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';

(async () => {
  try {
    const doc = await PDFDocument.create();
    const pdfPage = doc.addPage([500, 500]);
    pdfPage.drawText('HELLO WORLD', { x: 50, y: 450, size: 30, color: rgb(0,0,0) });
    fs.writeFileSync('test_export.pdf', await doc.save());

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    // Listen for dialogs (alerts)
    page.on('dialog', async dialog => {
      console.log('ALERT:', dialog.message());
      await dialog.accept();
    });
    
    console.log("1. Navigate...");
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    console.log("2. Upload PDF...");
    const input = await page.$('input[type="file"]');
    await input.uploadFile('test_export.pdf');
    await page.waitForSelector('.pdf-canvas', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("3. Clicking Export PDF button...");
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Export PDF')) {
        await btn.click();
        console.log("   Clicked Export PDF!");
        break;
      }
    }
    
    // Wait for the logs to come through
    await new Promise(r => setTimeout(r, 5000));
    
    await browser.close();
    console.log("DONE - Check the BROWSER logs above for [EXPORT] and [PdfViewer] entries");
  } catch (err) {
    console.error("TEST ERROR:", err);
  }
})();
