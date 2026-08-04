import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, FileUp, GitCompare } from 'lucide-react';
import VisualDiffViewer from '../components/VisualDiffViewer';
import '../App.css';

export default function CompareWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();

  // If navigated from home with a file, pre-populate fileA
  const initialFileA = location.state?.file || null;
  const initialUrlA = location.state?.url || null;

  const [fileA, setFileA] = useState(initialFileA);
  const [urlA, setUrlA] = useState(initialUrlA);
  
  const [fileB, setFileB] = useState(null);
  const [urlB, setUrlB] = useState(null);

  const handleUploadA = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileA(file);
      setUrlA(URL.createObjectURL(file));
    }
  };

  const handleUploadB = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileB(file);
      setUrlB(URL.createObjectURL(file));
    }
  };

  const reset = () => {
    setFileA(null);
    setUrlA(null);
    setFileB(null);
    setUrlB(null);
  };

  if (fileA && fileB) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'white' }}>
        <header style={{ 
          height: '60px', display: 'flex', alignItems: 'center', padding: '0 1.5rem', 
          borderBottom: '1px solid var(--border-color)', justifyContent: 'space-between', 
          flexShrink: 0, backgroundColor: 'white' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', padding: 0, color: '#171717', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={24} />
            </button>
            <span style={{ fontSize: '1.1rem', fontWeight: 500, color: '#171717', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <GitCompare size={18} color="#3b82f6" />
              Diff Viewer
            </span>
          </div>
          <button className="btn-secondary" onClick={reset}>
            New Comparison
          </button>
        </header>

        <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <VisualDiffViewer urlA={urlA} urlB={urlB} />
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: '#f8fafc' }}>
      <header style={{ height: '60px', display: 'flex', alignItems: 'center', padding: '0 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'white' }}>
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', padding: 0, color: '#171717', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={24} />
        </button>
        <span style={{ marginLeft: '1rem', fontSize: '1.1rem', fontWeight: 500, color: '#171717' }}>Compare PDFs</span>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem', gap: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#171717', margin: 0 }}>Select files to compare</h2>
        
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* File A Upload Box */}
          <div className="upload-overlay glass-panel" style={{ width: '300px', height: '300px', background: fileA ? '#ecfdf5' : 'white', borderColor: fileA ? '#10b981' : 'var(--border-color)' }}>
            <h3 style={{ fontSize: '1.2rem', color: fileA ? '#065f46' : '#171717', marginBottom: '1rem' }}>1. Original File</h3>
            {fileA ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#047857', fontWeight: 600, wordBreak: 'break-all' }}>{fileA.name}</p>
                <button onClick={() => { setFileA(null); setUrlA(null); }} style={{ background: 'none', border: 'none', color: '#10b981', textDecoration: 'underline', cursor: 'pointer', marginTop: '1rem' }}>Change</button>
              </div>
            ) : (
              <>
                <FileUp className="upload-icon" />
                <input type="file" onChange={handleUploadA} accept=".pdf" className="hidden-input" id="compare-upload-a" />
                <label htmlFor="compare-upload-a" className="btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', padding: '0.8rem 1.5rem' }}>
                  Upload Original
                </label>
              </>
            )}
          </div>

          {/* File B Upload Box */}
          <div className="upload-overlay glass-panel" style={{ width: '300px', height: '300px', background: fileB ? '#ecfdf5' : 'white', borderColor: fileB ? '#10b981' : 'var(--border-color)' }}>
            <h3 style={{ fontSize: '1.2rem', color: fileB ? '#065f46' : '#171717', marginBottom: '1rem' }}>2. Modified File</h3>
            {fileB ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#047857', fontWeight: 600, wordBreak: 'break-all' }}>{fileB.name}</p>
                <button onClick={() => { setFileB(null); setUrlB(null); }} style={{ background: 'none', border: 'none', color: '#10b981', textDecoration: 'underline', cursor: 'pointer', marginTop: '1rem' }}>Change</button>
              </div>
            ) : (
              <>
                <FileUp className="upload-icon" />
                <input type="file" onChange={handleUploadB} accept=".pdf" className="hidden-input" id="compare-upload-b" />
                <label htmlFor="compare-upload-b" className="btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', padding: '0.8rem 1.5rem' }}>
                  Upload Modified
                </label>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
