import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

bates_logic = """
        // Bates Numbering
        if (batesConfig.enabled) {
          const batesFont = await pdfLibDoc.embedFont(StandardFonts.Helvetica);
          const { prefix, suffix, startNumber, digitPadding, position, fontSize, fontColor, pageRange } = batesConfig;
          const rgbColor = hexToRgb(fontColor);

          let batesIndex = 0;
          for (let i = 0; i < pageOrder.length; i++) {
            const pId = pageOrder[i].id;
            const page = pages[i];
            
            if (pageRange === 'current' && pId !== activePageId) {
              continue;
            }

            const formattedNumber = prefix + String(startNumber + batesIndex).padStart(digitPadding, '0') + suffix;
            const textWidth = batesFont.widthOfTextAtSize(formattedNumber, fontSize);
            const textHeight = batesFont.heightAtSize(fontSize);
            
            const { width, height } = page.getSize();
            let x, y;
            const margin = 30;

            if (position.includes('left')) x = margin;
            else if (position.includes('right')) x = width - textWidth - margin;
            else x = (width - textWidth) / 2;

            if (position.includes('top')) y = height - textHeight - margin;
            else y = margin; // bottom

            page.drawText(formattedNumber, {
              x, y,
              size: fontSize,
              font: batesFont,
              color: rgb(rgbColor.red, rgbColor.green, rgbColor.blue)
            });

            batesIndex++;
          }
        }
"""

content = content.replace("// Apply Metadata", bates_logic + "\n        // Apply Metadata")

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
