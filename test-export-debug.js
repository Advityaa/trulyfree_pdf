import puppeteer from 'puppeteer';
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';

(async () => {
  try {
    // Create a simple test PDF
    const doc = await PDFDocument.create();
    const pdfPage = doc.addPage([500, 500]);
    pdfPage.drawText('HELLO WORLD', { x: 50, y: 450, size: 30, color: rgb(0,0,0) });
    const bytes = await doc.save();
    fs.writeFileSync('test_export.pdf', bytes);

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Capture ALL console logs
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    console.log("1. Navigating to app...");
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    console.log("2. Uploading test PDF...");
    const input = await page.$('input[type="file"]');
    await input.uploadFile('test_export.pdf');
    
    console.log("3. Waiting for canvas to render...");
    await page.waitForSelector('.pdf-canvas', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Check if export URL is ready
    console.log("4. Checking export button state...");
    const exportBtnState = await page.evaluate(() => {
      const a = document.querySelector('a[download]');
      if (!a) return { found: false };
      return { 
        found: true, 
        href: a.href,
        text: a.textContent.trim(),
        className: a.className,
        tagName: a.tagName,
        pointerEvents: window.getComputedStyle(a).pointerEvents,
        opacity: window.getComputedStyle(a).opacity
      };
    });
    console.log("Export button state:", JSON.stringify(exportBtnState, null, 2));
    
    // Also check for regular button
    const btnState = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.map(b => ({ text: b.textContent.trim(), disabled: b.disabled }));
    });
    console.log("All buttons:", JSON.stringify(btnState, null, 2));
    
    // Check if onExportReady was ever called  
    console.log("5. Waiting 5 more seconds for background generation...");
    await new Promise(r => setTimeout(r, 5000));
    
    const exportBtnState2 = await page.evaluate(() => {
      const a = document.querySelector('a[download]');
      if (!a) return { found: false };
      return { 
        found: true, 
        href: a.href.substring(0, 100),
        text: a.textContent.trim(),
        pointerEvents: window.getComputedStyle(a).pointerEvents
      };
    });
    console.log("Export button state after wait:", JSON.stringify(exportBtnState2, null, 2));

    await browser.close();
    console.log("DONE");
  } catch (err) {
    console.error("TEST ERROR:", err);
  }
})();
