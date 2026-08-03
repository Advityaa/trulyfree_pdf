import puppeteer from 'puppeteer';
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

(async () => {
  try {
    const doc = await PDFDocument.create();
    const pdfPage = doc.addPage([500, 500]);
    pdfPage.drawText('HELLO WORLD', { x: 50, y: 450, size: 30, color: rgb(0,0,0) });
    fs.writeFileSync('test_export.pdf', await doc.save());

    const downloadPath = path.resolve('./test_downloads');
    if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath);

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Set download behavior
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath,
    });
    
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    console.log("1. Navigate...");
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    console.log("2. Upload PDF...");
    const input = await page.$('input[type="file"]');
    await input.uploadFile('test_export.pdf');
    await page.waitForSelector('.pdf-canvas', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 3000));
    
    console.log("3. Clicking export link...");
    const exportLink = await page.$('a[download]');
    if (exportLink) {
      await exportLink.click();
      console.log("   Clicked! Waiting 3s for download...");
      await new Promise(r => setTimeout(r, 3000));
      
      const files = fs.readdirSync(downloadPath);
      console.log("4. Downloaded files:", files);
      if (files.length > 0) {
        console.log("SUCCESS: File downloaded!");
        const fileSize = fs.statSync(path.join(downloadPath, files[0])).size;
        console.log("   File size:", fileSize, "bytes");
      } else {
        console.log("FAILURE: No files downloaded. The <a download> blob approach does NOT work.");
      }
    } else {
      console.log("FAILURE: No export link found");
    }
    
    await browser.close();
    
    // Cleanup
    fs.rmSync(downloadPath, { recursive: true, force: true });
    console.log("DONE");
  } catch (err) {
    console.error("TEST ERROR:", err);
  }
})();
