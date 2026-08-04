import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

# Find the exportPdfBytes block
start_tag = "exportPdfBytes: async () => {"
end_tag = "return await pdfLibDoc.save();"

start_idx = content.find(start_tag)
end_idx = content.find(end_tag, start_idx) + len(end_tag)

if start_idx != -1 and end_idx != -1:
    new_export = """exportPdfBytes: async () => {
      console.log("[PdfViewer] exportPdfBytes called");
      try {
        const originalBytes = file ? await file.arrayBuffer() : encryptedFileBytes;
        const originalDoc = await PDFDocument.load(originalBytes);
        
        const pdfLibDoc = await PDFDocument.create();
        
        const requiredOriginalIndices = pageOrder.filter(p => !p.isBlank).map(p => p.originalIndex);
        const copiedPages = requiredOriginalIndices.length > 0 
           ? await pdfLibDoc.copyPages(originalDoc, requiredOriginalIndices) 
           : [];
           
        let copyIdx = 0;
        for (const p of pageOrder) {
           let newPage;
           if (p.isBlank) {
              newPage = pdfLibDoc.addPage([595.28, 841.89]);
           } else {
              newPage = copiedPages[copyIdx++];
              pdfLibDoc.addPage(newPage);
           }
           if (p.rotation) {
              newPage.setRotation(degrees(newPage.getRotation().angle + p.rotation));
           }
        }
        
        const pages = pdfLibDoc.getPages();

        for (let i = 0; i < pageOrder.length; i++) {
          const p = pageOrder[i];
          const page = pages[i];
          const pId = p.id;

          // Text Edits
          const pageEdits = edits[pId];
          if (pageEdits) {
            for (const edit of Object.values(pageEdits)) {
              const { line, newValue } = edit;
              const firstFrag = line.fragments[0];
              if (firstFrag && firstFrag.unscaledTransform) {
                const tx = firstFrag.unscaledTransform[4];
                const ty = firstFrag.unscaledTransform[5];
                const boxWidth = line.unscaledWidth;
                const [scaleX, skewY] = firstFrag.unscaledTransform;
                const fontSize = Math.sqrt(scaleX * scaleX + skewY * skewY);
                const angleRad = Math.atan2(skewY, scaleX);
                const boxHeight = line.unscaledHeight || fontSize;

                page.drawRectangle({
                  x: tx - 1,
                  y: ty - boxHeight * 0.2 - 1,
                  width: boxWidth + 2,
                  height: boxHeight + 2,
                  color: rgb(1, 1, 1),
                  rotate: radians(angleRad)
                });

                const helveticaFont = await pdfLibDoc.embedFont(StandardFonts.Helvetica);
                page.drawText(newValue, {
                  x: tx,
                  y: ty,
                  size: fontSize,
                  font: helveticaFont,
                  color: rgb(0, 0, 0),
                  rotate: radians(angleRad)
                });
              }
            }
          }

          // Annotations
          const pageAnnots = annotations[pId];
          if (pageAnnots) {
            for (const annot of pageAnnots) {
              if (annot.type === 'ink' || annot.type === 'highlight') {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                const inkList = annot.inkList.map(pts => {
                   const arr = [];
                   for(let j=0; j<pts.length; j+=2) {
                      minX = Math.min(minX, pts[j]);
                      minY = Math.min(minY, pts[j+1]);
                      maxX = Math.max(maxX, pts[j]);
                      maxY = Math.max(maxY, pts[j+1]);
                      arr.push(pdfLibDoc.context.obj(pts[j]), pdfLibDoc.context.obj(pts[j+1]));
                   }
                   return pdfLibDoc.context.obj(arr);
                });
                
                const rgbColor = hexToRgb(annot.color);
                
                const dict = pdfLibDoc.context.obj({
                  Type: 'Annot',
                  Subtype: 'Ink',
                  Rect: [minX - annot.thickness, minY - annot.thickness, maxX + annot.thickness, maxY + annot.thickness],
                  InkList: inkList,
                  C: [rgbColor.red, rgbColor.green, rgbColor.blue],
                  BS: pdfLibDoc.context.obj({ Type: 'Border', S: 'S', W: annot.thickness }),
                  CA: annot.opacity
                });
                
                const annotRef = pdfLibDoc.context.register(dict);
                page.node.addAnnot(annotRef);
              }
            }
          }

          // Signatures
          const pageSigs = signatures[pId];
          if (pageSigs) {
            const pageHeight = page.getHeight();
            for (const sig of pageSigs) {
              let embeddedImage;
              if (sig.type === 'image/png') {
                embeddedImage = await pdfLibDoc.embedPng(sig.bytes);
              } else {
                embeddedImage = await pdfLibDoc.embedJpg(sig.bytes);
              }
              page.drawImage(embeddedImage, {
                x: sig.x,
                y: pageHeight - sig.y - sig.height,
                width: sig.width,
                height: sig.height
              });
            }
          }

          // Redactions
          const pageRedacts = redactions[pId];
          if (pageRedacts) {
            for (const redact of pageRedacts) {
               page.drawRectangle({
                  x: redact.pdfX,
                  y: redact.pdfY,
                  width: redact.pdfW,
                  height: redact.pdfH,
                  color: rgb(0,0,0)
               });
            }
          }
        }
        
        // Watermark
        if (watermarkConfig.enabled) {
          let embeddedWatermarkImg = null;
          if (watermarkConfig.mode === 'image' && watermarkConfig.imageData) {
            if (watermarkConfig.imageType === 'image/png') {
              embeddedWatermarkImg = await pdfLibDoc.embedPng(watermarkConfig.imageData);
            } else {
              embeddedWatermarkImg = await pdfLibDoc.embedJpg(watermarkConfig.imageData);
            }
          }

          for (let i = 0; i < pageOrder.length; i++) {
            const pId = pageOrder[i].id;
            const page = pages[i];
            
            if (watermarkConfig.pageRange === 'current' && pId !== activePageId) {
              continue; // Skip
            }

            const { width, height } = page.getSize();
            const { mode, text, fontSize, rotationDeg, opacity, tiled, tileSpacing } = watermarkConfig;
            
            const drawContent = (x, y) => {
              if (mode === 'text' && text) {
                 page.drawText(text, { x, y, size: fontSize, opacity, rotate: degrees(rotationDeg), color: rgb(0,0,0) });
              } else if (mode === 'image' && embeddedWatermarkImg) {
                 const imgDims = embeddedWatermarkImg.scale(0.5);
                 page.drawImage(embeddedWatermarkImg, { x, y, width: imgDims.width, height: imgDims.height, opacity, rotate: degrees(rotationDeg) });
              }
            };

            if (!tiled) {
              drawContent(width / 2, height / 2);
            } else {
              const spacing = tileSpacing + 150; 
              for (let x = -width; x < width * 2; x += spacing) {
                for (let y = -height; y < height * 2; y += spacing) {
                  drawContent(x, y);
                }
              }
            }
          }
        }

        // Apply Encryption
        if (securityConfig.isEncrypted) {
           pdfLibDoc.encrypt({
              userPassword: securityConfig.userPassword || undefined,
              ownerPassword: securityConfig.ownerPassword || undefined,
              permissions: {
                printing: securityConfig.permissions.printing === 'highRes' ? 'highResolution' : (securityConfig.permissions.printing === 'lowRes' ? 'lowResolution' : undefined),
                modifying: securityConfig.permissions.modifying,
                copying: securityConfig.permissions.copying,
                annotating: securityConfig.permissions.annotating,
                fillingForms: securityConfig.permissions.fillingForms,
                documentAssembly: securityConfig.permissions.modifying
              }
           });
        }

        return await pdfLibDoc.save();"""

    content = content[:start_idx] + new_export + content[end_idx:]

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
