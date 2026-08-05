import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

# Add isEnhancingOCR state
state_vars = """
  const [textLines, setTextLines] = useState([]);
  const [isEnhancingOCR, setIsEnhancingOCR] = useState(false);
"""
content = content.replace("  const [textLines, setTextLines] = useState([]);", state_vars)

# Add handleEnhanceOCR function
enhance_func = """
  const handleEnhanceOCR = async () => {
    try {
      setIsEnhancingOCR(true);
      const page = await pdfDocRef.current.getPage(activePage.originalIndex + 1);
      const viewport = page.getViewport({ scale: 2.0, rotation: 0 }); 
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 1.0));
      const formData = new FormData();
      formData.append('file', blob, 'page.jpg');
      
      const res = await fetch('http://localhost:8000/api/ocr/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      const ocrLines = data.blocks.map(block => {
         const unscaledW = block.width / 2.0;
         const unscaledH = block.height / 2.0;
         const unscaledX = block.x / 2.0;
         const unscaledY = block.y / 2.0; 
         
         const pdfY = (viewport.height / 2.0) - unscaledY - unscaledH;
         
         const baseTransform = [unscaledH, 0, 0, unscaledH, unscaledX, pdfY];
         const scaledTransform = pdfjsLib.Util.transform(currentViewport.transform, baseTransform);
         
         return {
            originalStr: block.text,
            isOcr: true,
            unscaledTransform: baseTransform,
            transform: scaledTransform,
            width: unscaledW * scale,
            unscaledWidth: unscaledW,
            fontName: 'OCR-Font'
         };
      });
      
      // Merge with existing textLines, avoiding duplicates
      setTextLines(prev => {
         const newLines = ocrLines.filter(ocrLine => {
            const cx = ocrLine.unscaledTransform[4] + ocrLine.unscaledWidth / 2;
            const cy = ocrLine.unscaledTransform[5] + ocrLine.unscaledTransform[3] / 2;
            return !prev.some(line => {
               const lx = line.unscaledTransform[4];
               const ly = line.unscaledTransform[5];
               const lw = line.unscaledWidth;
               const lh = line.unscaledTransform[3]; 
               return cx >= lx - 5 && cx <= lx + lw + 5 && cy >= ly - 5 && cy <= ly + lh + 5;
            });
         });
         return [...prev, ...newLines];
      });
    } catch(err) {
      alert("OCR failed: " + err.message);
    } finally {
      setIsEnhancingOCR(false);
    }
  };
"""

content = content.replace("  const handleTextClick = (index) => {", enhance_func + "\n  const handleTextClick = (index) => {")

# Add button to Text Edit toolbar
button_html = """
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button className="tool-btn" onClick={handleEnhanceOCR} disabled={isEnhancingOCR} style={{ background: '#3b82f6', color: 'white', borderRadius: '6px', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ScanText size={16} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{isEnhancingOCR ? 'Scanning...' : 'Enhance with OCR'}</span>
            </button>
          </div>
"""
content = content.replace("        <div style={{ display: 'flex', gap: '1rem', width: '100%', alignItems: 'center' }}>\n          <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#334155' }}>Click any text in the document to edit it</span>\n        </div>", "        <div style={{ display: 'flex', gap: '1rem', width: '100%', alignItems: 'center' }}>\n          <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#334155' }}>Click any text in the document to edit it</span>\n" + button_html + "\n        </div>")

# Update exportPdfBytes to draw masking rectangle for edits
export_logic = """
          if (edit.type === 'text_change') {
            const font = await pdfLibDoc.embedFont(StandardFonts.Helvetica);
            
            // Mask the original text
            page.drawRectangle({
               x: edit.line.unscaledTransform[4],
               y: edit.line.unscaledTransform[5] - (edit.line.unscaledTransform[3] * 0.2),
               width: edit.line.unscaledWidth,
               height: edit.line.unscaledTransform[3] * 1.2,
               color: rgb(1, 1, 1),
            });
            
            page.drawText(edit.newValue, {
"""
content = content.replace("          if (edit.type === 'text_change') {\n            const font = await pdfLibDoc.embedFont(StandardFonts.Helvetica);\n            \n            page.drawText(edit.newValue, {", export_logic)

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
