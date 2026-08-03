import { useState, useRef } from 'react'
import { FileUp, Save, Type, FileEdit, MousePointer2, Pen, Highlighter } from 'lucide-react'
import PdfViewer from './components/PdfViewer'
import './App.css'

function App() {
  const [pdfFile, setPdfFile] = useState(null)
  const [activeTool, setActiveTool] = useState('select') // 'select', 'text', 'draw', 'highlight'
  const fileInputRef = useRef(null)
  const viewerRef = useRef(null)
  const [isExporting, setIsExporting] = useState(false)

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const fileUrl = URL.createObjectURL(file)
      setPdfFile({ url: fileUrl, file })
    } else {
      alert("Please upload a valid PDF file.");
    }
  }

  const handleExport = async () => {
    console.log("[EXPORT] Step 1: Export button clicked");

    if (!viewerRef.current) {
      console.error("[EXPORT] FAIL: viewerRef.current is null");
      alert("Error: PDF viewer not ready");
      return;
    }

    setIsExporting(true);

    try {
      console.log("[EXPORT] Step 2: Calling exportPdfBytes()...");
      const pdfBytes = await viewerRef.current.exportPdfBytes();
      console.log("[EXPORT] Step 3: Got PDF bytes, length =", pdfBytes ? pdfBytes.byteLength : "NULL");

      if (!pdfBytes || pdfBytes.byteLength === 0) {
        alert("Error: PDF generation returned empty data");
        setIsExporting(false);
        return;
      }

      if (window.showSaveFilePicker) {
        console.log("[EXPORT] Step 4a: Using showSaveFilePicker...");
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: 'edited_document.pdf',
            types: [{
              description: 'PDF Document',
              accept: { 'application/pdf': ['.pdf'] },
            }],
          });
          const writable = await fileHandle.createWritable();
          await writable.write(pdfBytes);
          await writable.close();
          alert("PDF saved successfully!");
        } catch (pickerErr) {
          if (pickerErr.name === 'AbortError') {
            console.log("[EXPORT] User cancelled the save dialog");
          } else {
            console.error("[EXPORT] Save dialog error:", pickerErr);
            alert("Save dialog error: " + pickerErr.message);
          }
        }
      } else {
        console.log("[EXPORT] Step 4b: Fallback to anchor download...");
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited_document.pdf';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 60000);
        alert("PDF export triggered!");
      }
    } catch (err) {
      console.error("[EXPORT] FATAL ERROR:", err);
      alert("Export failed: " + err.message);
    }

    setIsExporting(false);
  }

  return (
    <div className="app-container">
      <div className="toolbar-title">
        <FileEdit size={24} color="#3b82f6" />
        TrulyFree PDF
      </div>
      
      {pdfFile && (
        <div className="floating-toolbar">
          <button 
            className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`} 
            onClick={() => setActiveTool('select')} 
            title="Select Tool"
          >
            <MousePointer2 size={20} />
          </button>
          <button 
            className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`} 
            onClick={() => setActiveTool('text')} 
            title="Edit Text"
          >
            <Type size={20} />
          </button>
          <button 
            className={`tool-btn ${activeTool === 'draw' ? 'active' : ''}`} 
            onClick={() => setActiveTool('draw')} 
            title="Draw"
          >
            <Pen size={20} />
          </button>
          <button 
            className={`tool-btn ${activeTool === 'highlight' ? 'active' : ''}`} 
            onClick={() => setActiveTool('highlight')} 
            title="Highlight"
          >
            <Highlighter size={20} />
          </button>
          <div className="toolbar-divider" />
          <button className="btn-primary" onClick={handleExport} disabled={isExporting}>
            <Save size={18} />
            {isExporting ? 'Saving...' : 'Export'}
          </button>
        </div>
      )}

      <main className="main-content">
        {!pdfFile ? (
          <div className="upload-overlay glass-panel" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="upload-icon" />
            <h2>Upload a Document</h2>
            <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>Drag & drop or click to browse</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".pdf" 
              className="hidden-input"
            />
          </div>
        ) : (
          <div className="pdf-workspace">
            <PdfViewer 
              pdfUrl={pdfFile.url} 
              file={pdfFile.file} 
              activeTool={activeTool}
              ref={viewerRef}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
