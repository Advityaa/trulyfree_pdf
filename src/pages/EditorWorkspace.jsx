import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Save, ArrowLeft } from 'lucide-react'
import PdfViewer from '../components/PdfViewer'
import '../App.css'

function EditorWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const file = location.state?.file;
  const pdfUrl = location.state?.url;
  
  const [activeTool, setActiveTool] = useState('select') // 'select', 'text', 'draw', 'highlight', 'sign'
  const viewerRef = useRef(null)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (!file || !pdfUrl) {
      navigate('/');
    }
  }, [file, pdfUrl, navigate]);

  const handleExport = async () => {
    if (!viewerRef.current) return;
    setIsExporting(true);

    try {
      const pdfBytes = await viewerRef.current.exportPdfBytes();
      if (!pdfBytes || pdfBytes.byteLength === 0) {
        alert("Error: PDF generation returned empty data");
        setIsExporting(false);
        return;
      }

      if (window.showSaveFilePicker) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: `edited_${file?.name || 'document'}.pdf`,
            types: [{
              description: 'PDF Document',
              accept: { 'application/pdf': ['.pdf'] },
            }],
          });
          const writable = await fileHandle.createWritable();
          await writable.write(pdfBytes);
          await writable.close();
        } catch (pickerErr) {
          if (pickerErr.name !== 'AbortError') {
            alert("Save dialog error: " + pickerErr.message);
          }
        }
      } else {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_${file?.name || 'document'}.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 60000);
      }
    } catch (err) {
      console.error("[EXPORT] FATAL ERROR:", err);
      alert("Export failed: " + err.message);
    }

    setIsExporting(false);
  }

  if (!file || !pdfUrl) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'white' }}>
      
      {/* Header */}
      <header style={{ 
        height: '60px', 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 1.5rem', 
        borderBottom: '1px solid var(--border-color)', 
        justifyContent: 'space-between', 
        flexShrink: 0, 
        zIndex: 50, 
        backgroundColor: 'white' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', padding: 0, color: '#171717', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={24} />
          </button>
          <span style={{ fontSize: '1.1rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px', color: '#171717' }}>
            {file.name}
          </span>
        </div>
        
        <button className="btn-primary" onClick={handleExport} disabled={isExporting} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Save size={18} />
          {isExporting ? 'Saving...' : 'Download'}
        </button>
      </header>

      {/* Main Workspace */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        <PdfViewer 
          pdfUrl={pdfUrl} 
          file={file} 
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          ref={viewerRef}
        />
      </main>

    </div>
  )
}

export default EditorWorkspace
