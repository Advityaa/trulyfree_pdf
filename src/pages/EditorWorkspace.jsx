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
    // If we passed an initial tool from navigation state, set it
    if (location.state?.initialTool) {
      setActiveTool(location.state.initialTool);
    }
  }, [location.state]);

  const handleEditorUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    
    if (uploadedFile.type === 'application/pdf' || uploadedFile.name.toLowerCase().endsWith('.pdf')) {
      const fileUrl = URL.createObjectURL(uploadedFile);
      // Replace the current history entry so location.state has the file
      navigate('/editor', { replace: true, state: { ...location.state, file: uploadedFile, url: fileUrl } });
    } else {
      alert("Please upload a valid PDF file.");
    }
  };

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
        const fileName = `edited_${file?.name || 'document'}.pdf`;
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        // Try native Web Share API first for iOS/Android Safari/Chrome
        if (navigator.share && navigator.canShare) {
          const shareFile = new File([blob], fileName, { type: 'application/pdf' });
          if (navigator.canShare({ files: [shareFile] })) {
            try {
              await navigator.share({ title: fileName, files: [shareFile] });
              setIsExporting(false);
              return; // Success!
            } catch (e) {
              console.log("Share cancelled or failed, falling back to download", e);
            }
          }
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
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

  if (!file || !pdfUrl) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: '#f8fafc' }}>
        <header style={{ height: '60px', display: 'flex', alignItems: 'center', padding: '0 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'white' }}>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', padding: 0, color: '#171717', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={24} />
          </button>
          <span style={{ marginLeft: '1rem', fontSize: '1.1rem', fontWeight: 500, color: '#171717' }}>Editor Workspace</span>
        </header>
        <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
          <div className="upload-overlay glass-panel" style={{ width: '100%', maxWidth: '600px', background: 'white' }}>
            <h2 style={{ fontSize: '1.5rem', color: '#171717', marginBottom: '1.5rem' }}>Upload a PDF to start editing</h2>
            <input type="file" onChange={handleEditorUpload} accept=".pdf" className="hidden-input" id="editor-upload" />
            <label htmlFor="editor-upload" className="btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', padding: '0.8rem 2rem', fontSize: '1.1rem' }}>
              Select File
            </label>
          </div>
        </main>
      </div>
    );
  }
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
