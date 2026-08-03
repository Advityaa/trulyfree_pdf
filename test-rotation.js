import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fs from 'fs';

(async () => {
  const doc = await PDFDocument.create();
  const pdfPage = doc.addPage([500, 500]);
  
  pdfPage.setRotation(degrees(180));
  pdfPage.drawText('UPSIDE DOWN TEST', { x: 50, y: 450, size: 30, color: rgb(0,0,0) });
  
  const bytes = await doc.save();
  fs.writeFileSync('upside_down.pdf', bytes);
  console.log("Created upside_down.pdf");
})();
