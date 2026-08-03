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
    
    console.log("3. Waiting for background generation + data URI conversion...");
    await new Promise(r => setTimeout(r, 5000));
    
    // Check the href — it should now be a data: URI not a blob: URI
    const linkInfo = await page.evaluate(() => {
      const a = document.querySelector('a[download]');
      if (!a) return { found: false };
      return { 
        found: true, 
        hrefPrefix: a.href.substring(0, 30),
        text: a.textContent.trim(),
        isDataUri: a.href.startsWith('data:'),
        isBlobUri: a.href.startsWith('blob:'),
      };
    });
    console.log("4. Export link info:", JSON.stringify(linkInfo, null, 2));
    
    console.log("5. Clicking export link...");
    const exportLink = await page.$('a[download]');
    if (exportLink) {
      await exportLink.click();
      await new Promise(r => setTimeout(r, 3000));
      
      const files = fs.readdirSync(downloadPath);
      console.log("6. Downloaded files:", files);
      if (files.length > 0) {
        const fileSize = fs.statSync(path.join(downloadPath, files[0])).size;
        console.log("SUCCESS! Downloaded:", files[0], "Size:", fileSize, "bytes");
      } else {
        console.log("FAILURE: No file downloaded");
      }
    }
    
    await browser.close();
    fs.rmSync(downloadPath, { recursive: true, force: true });
    console.log("DONE");
  } catch (err) {
    console.error("TEST ERROR:", err);
  }
})();
