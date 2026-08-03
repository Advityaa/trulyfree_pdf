import puppeteer from 'puppeteer';
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Capture console logs
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
    
    console.log("Navigating to app...");
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

    console.log("Uploading upside_down.pdf...");
    const input = await page.$('input[type="file"]');
    await input.uploadFile('upside_down.pdf');
    
    console.log("Waiting for canvas...");
    await page.waitForSelector('.pdf-canvas', { timeout: 5000 });
    
    console.log("Waiting a bit for render...");
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Clicking export button...");
    const buttons = await page.$$('button');
    let exportBtn;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Export PDF')) {
        exportBtn = btn;
        break;
      }
    }
    
    if (exportBtn) {
      await exportBtn.click();
      console.log("Clicked export button. Waiting for 3 seconds...");
      await new Promise(r => setTimeout(r, 3000));
    } else {
      console.log("Could not find Export button");
    }
    
    await browser.close();
    console.log("Test script finished");
  } catch (err) {
    console.error("TEST SCRIPT ERROR:", err);
  }
})();
