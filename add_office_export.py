import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

# Add imports
content = content.replace("import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';", "import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';\nimport pptxgen from 'pptxgenjs';")
content = content.replace("import { RotateCw,", "import { FileOutput, RotateCw,")

# Add state for Export Menu
state_vars = """
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
"""
content = content.replace("  const [isPkiModalOpen, setIsPkiModalOpen] = useState(false);", state_vars + "  const [isPkiModalOpen, setIsPkiModalOpen] = useState(false);")


# PPTX Export Logic
pptx_logic = """
  const exportToPPTX = async () => {
     try {
        setIsExportMenuOpen(false);
        if (!pages || pages.length === 0) return;
        
        const pres = new pptxgen();
        
        for (let i = 0; i < pageOrder.length; i++) {
            const pageConfig = pageOrder[i];
            // Re-render the page at high scale for PPTX
            const pdfPage = pages.find(p => p.id === pageConfig.id);
            if (!pdfPage) continue;
            
            const viewport = pdfPage.getViewport({ scale: 2.0, rotation: pageConfig.rotation || 0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            
            await pdfPage.render({ canvasContext: ctx, viewport }).promise;
            const dataUrl = canvas.toDataURL('image/png');
            
            // Add slide and set background
            const slide = pres.addSlide();
            slide.background = { data: dataUrl };
        }
        
        pres.writeFile({ fileName: 'Presentation.pptx' });
     } catch (err) {
        console.error(err);
        alert("Failed to export to PPTX: " + err.message);
     }
  };
  
  const exportToBackend = async (format) => {
     try {
        setIsExportMenuOpen(false);
        const pdfBytes = await pdfDocRef.current.saveDocument();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        const formData = new FormData();
        formData.append('file', blob);
        
        const res = await fetch(`http://localhost:8000/api/convert/${format}`, {
           method: 'POST',
           body: formData
        });
        
        if (!res.ok) {
           const err = await res.json();
           throw new Error(err.error || "Failed to convert");
        }
        
        const outBlob = await res.blob();
        const url = URL.createObjectURL(outBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Converted.${format}`;
        a.click();
     } catch (err) {
        alert("Conversion Failed: " + err.message);
     }
  };
"""

# Insert logic before return
content = content.replace("  return (", pptx_logic + "\n  return (")

# Add Export Button to toolbar (right side)
export_btn = """
        <div style={{ position: 'relative' }}>
          <button className="tool-btn" onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} title="Convert to Office" style={{ marginLeft: '1rem', background: '#3b82f6', color: 'white', borderRadius: '6px', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}>
            <FileOutput size={16} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Convert</span>
          </button>
          
          {isExportMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 1000, width: '180px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
               <button onClick={exportToPPTX} style={{ padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.85rem' }}>Convert to PPTX</button>
               <button onClick={() => exportToBackend('xlsx')} style={{ padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.85rem' }}>Convert to XLSX</button>
               <button onClick={() => exportToBackend('docx')} style={{ padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>Convert to DOCX (Beta)</button>
            </div>
          )}
        </div>
"""
content = content.replace("      </div>\n    </div>", "      </div>\n" + export_btn + "\n    </div>")

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
