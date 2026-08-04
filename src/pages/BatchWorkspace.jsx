import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, Play, Download, Loader2, CheckCircle, XCircle } from 'lucide-react';
import JSZip from 'jszip';
import pLimit from 'p-limit';
import '../App.css';

export default function BatchWorkspace() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [files, setFiles] = useState([]); // { file, id, status: 'queued'|'processing'|'done'|'error', resultBlob: null }
  const [operation, setOperation] = useState('ocr'); // ocr, xlsx, docx
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalZipUrl, setFinalZipUrl] = useState(null);

  const handleFileUpload = (e) => {
    const uploadedFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const newFiles = uploadedFiles.map(f => ({
      file: f,
      id: Math.random().toString(36).substr(2, 9),
      status: 'queued',
      resultBlob: null,
      errorMsg: null
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id) => {
    if (isProcessing) return;
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const processBatch = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setFinalZipUrl(null);
    
    // Reset statuses
    setFiles(prev => prev.map(f => ({ ...f, status: 'queued', resultBlob: null, errorMsg: null })));
    
    const limit = pLimit(3); // Max concurrency 3
    
    const tasks = files.map(fileObj => limit(async () => {
      // Mark as processing
      setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'processing' } : f));
      
      try {
        const formData = new FormData();
        formData.append('file', fileObj.file);
        
        const endpoint = operation === 'ocr' ? 'http://localhost:8000/api/ocr' : `http://localhost:8000/api/convert/${operation}`;
        
        const res = await fetch(endpoint, {
          method: 'POST',
          body: formData
        });
        
        if (!res.ok) {
           const err = await res.json();
           throw new Error(err.error || 'Failed');
        }
        
        let resultBlob;
        if (operation === 'ocr') {
           const json = await res.json();
           if (!json.success) throw new Error(json.error);
           resultBlob = new Blob([json.text], { type: 'text/plain' });
        } else {
           resultBlob = await res.blob();
        }
        
        setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'done', resultBlob } : f));
      } catch (err) {
        setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'error', errorMsg: err.message } : f));
      }
    }));
    
    await Promise.all(tasks);
    setIsProcessing(false);
    
    // Create ZIP
    setFiles(currentFiles => {
      const successful = currentFiles.filter(f => f.status === 'done');
      if (successful.length > 0) {
        const zip = new JSZip();
        successful.forEach(f => {
           const ext = operation === 'ocr' ? 'txt' : operation;
           const originalName = f.file.name.replace(/\.pdf$/i, '');
           zip.file(`${originalName}_converted.${ext}`, f.resultBlob);
        });
        zip.generateAsync({ type: 'blob' }).then(zipBlob => {
           setFinalZipUrl(URL.createObjectURL(zipBlob));
        });
      }
      return currentFiles;
    });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <header style={{ padding: '1rem 2rem', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate('/')} className="icon-btn">
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>Batch Processor</h1>
      </header>

      <main style={{ flex: 1, padding: '2rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Select Operation</label>
              <select 
                value={operation} 
                onChange={e => setOperation(e.target.value)}
                disabled={isProcessing}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
              >
                <option value="ocr">Extract Text (OCR)</option>
                <option value="xlsx">Convert to Excel (.xlsx)</option>
                <option value="docx">Convert to Word (.docx)</option>
              </select>
            </div>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 600 }}
            >
              <UploadCloud size={18} /> Add Files
            </button>
            <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} accept=".pdf" style={{ display: 'none' }} />
            
            <button 
              onClick={processBatch}
              disabled={isProcessing || files.length === 0}
              style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 2rem', borderRadius: '8px', cursor: isProcessing || files.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 600, opacity: isProcessing || files.length === 0 ? 0.7 : 1 }}
            >
              {isProcessing ? <Loader2 size={18} className="spin" /> : <Play size={18} />}
              {isProcessing ? 'Processing...' : 'Run Batch'}
            </button>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
              <span>Files ({files.length})</span>
              {finalZipUrl && (
                <a href={finalZipUrl} download="batch_results.zip" style={{ color: '#10b981', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Download size={16} /> Download All (ZIP)
                </a>
              )}
            </div>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {files.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                  <UploadCloud size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                  <p>No files added yet.</p>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {files.map(f => (
                    <li key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {f.status === 'queued' && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#cbd5e1' }} title="Queued" />}
                        {f.status === 'processing' && <Loader2 size={16} color="#3b82f6" className="spin" />}
                        {f.status === 'done' && <CheckCircle size={16} color="#10b981" />}
                        {f.status === 'error' && <XCircle size={16} color="#ef4444" />}
                        
                        <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{f.file.name}</span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {f.errorMsg && <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>{f.errorMsg}</span>}
                        <button 
                          onClick={() => removeFile(f.id)} 
                          disabled={isProcessing}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: isProcessing ? 'not-allowed' : 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
