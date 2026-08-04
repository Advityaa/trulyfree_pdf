import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pixelmatch from 'pixelmatch';
import { ChevronLeft, ChevronRight, Eye, Layers } from 'lucide-react';
import '../App.css';

export default function VisualDiffViewer({ urlA, urlB }) {
  const [pdfA, setPdfA] = useState(null);
  const [pdfB, setPdfB] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  
  const [diffOpacity, setDiffOpacity] = useState(0.7);
  const [showBase, setShowBase] = useState('A'); // 'A' or 'B'
  const [isProcessing, setIsProcessing] = useState(false);

  const canvasARef = useRef(null);
  const canvasBRef = useRef(null);
  const diffCanvasRef = useRef(null);
  const displayCanvasRef = useRef(null); // The background canvas

  // Initialize PDF.js
  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;
  }, []);

  // Load both PDFs
  useEffect(() => {
    const loadPdfs = async () => {
      try {
        const docA = await pdfjsLib.getDocument(urlA).promise;
        const docB = await pdfjsLib.getDocument(urlB).promise;
        setPdfA(docA);
        setPdfB(docB);
        setNumPages(Math.max(docA.numPages, docB.numPages));
        setPageNumber(1);
      } catch (err) {
        console.error("Error loading PDFs for diff:", err);
        alert("Failed to load one or both PDFs for comparison.");
      }
    };
    loadPdfs();
  }, [urlA, urlB]);

  const renderDiff = useCallback(async () => {
    if (!pdfA || !pdfB) return;
    setIsProcessing(true);

    try {
      const scale = 1.0; // Fixed scale for performance diffing
      
      let pageA = null;
      let pageB = null;
      let viewportA = null;
      let viewportB = null;

      if (pageNumber <= pdfA.numPages) {
        pageA = await pdfA.getPage(pageNumber);
        viewportA = pageA.getViewport({ scale });
      }
      
      if (pageNumber <= pdfB.numPages) {
        pageB = await pdfB.getPage(pageNumber);
        viewportB = pageB.getViewport({ scale });
      }

      // Determine dimensions (max of both)
      const wA = viewportA ? viewportA.width : 0;
      const hA = viewportA ? viewportA.height : 0;
      const wB = viewportB ? viewportB.width : 0;
      const hB = viewportB ? viewportB.height : 0;
      
      const width = Math.max(wA, wB, 1);
      const height = Math.max(hA, hB, 1);

      // Setup Canvases
      const cA = canvasARef.current;
      const cB = canvasBRef.current;
      const cDiff = diffCanvasRef.current;
      const cDisp = displayCanvasRef.current;

      [cA, cB, cDiff, cDisp].forEach(c => {
        c.width = width;
        c.height = height;
      });

      const ctxA = cA.getContext('2d');
      const ctxB = cB.getContext('2d');
      const ctxDiff = cDiff.getContext('2d');
      const ctxDisp = cDisp.getContext('2d');

      // Clear all
      [ctxA, ctxB, ctxDiff, ctxDisp].forEach(ctx => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
      });

      // Render A
      if (pageA) {
        await pageA.render({ canvasContext: ctxA, viewport: viewportA }).promise;
      }

      // Render B
      if (pageB) {
        await pageB.render({ canvasContext: ctxB, viewport: viewportB }).promise;
      }

      // Extract Image Data
      const imgDataA = ctxA.getImageData(0, 0, width, height);
      const imgDataB = ctxB.getImageData(0, 0, width, height);
      const diffData = ctxDiff.createImageData(width, height);

      // Run Pixelmatch
      pixelmatch(imgDataA.data, imgDataB.data, diffData.data, width, height, {
        threshold: 0.1,
        diffColor: [255, 0, 0] // Red
      });

      // Put diff data
      ctxDiff.putImageData(diffData, 0, 0);

      // Put background data based on user toggle
      if (showBase === 'A' && pageA) {
        ctxDisp.putImageData(imgDataA, 0, 0);
      } else if (showBase === 'B' && pageB) {
        ctxDisp.putImageData(imgDataB, 0, 0);
      } else {
         // white background if the selected page doesn't exist (e.g. Page 5 on a 4 page doc)
         ctxDisp.fillStyle = 'white';
         ctxDisp.fillRect(0, 0, width, height);
      }

    } catch (err) {
      console.error("Diff Rendering Error:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [pdfA, pdfB, pageNumber, showBase]);

  useEffect(() => {
    renderDiff();
  }, [renderDiff]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#f1f5f9' }}>
      {/* Diff Toolbar */}
      <div style={{ 
        display: 'flex', alignItems: 'center', padding: '0.75rem 1.5rem', 
        background: 'white', borderBottom: '1px solid var(--border-color)', gap: '2rem' 
      }}>
        
        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button 
            className="tool-btn" 
            onClick={() => setPageNumber(p => Math.max(1, p - 1))} 
            disabled={pageNumber <= 1}
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: '0.9rem', color: '#171717', width: '80px', textAlign: 'center', userSelect: 'none' }}>
            Page {pageNumber} of {numPages}
          </span>
          <button 
            className="tool-btn" 
            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} 
            disabled={pageNumber >= numPages}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Base Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} color="#64748b" />
          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Background:</span>
          <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
            <button 
              onClick={() => setShowBase('A')}
              style={{ padding: '0.25rem 0.75rem', border: 'none', background: showBase === 'A' ? '#3b82f6' : 'white', color: showBase === 'A' ? 'white' : '#64748b', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Original
            </button>
            <button 
              onClick={() => setShowBase('B')}
              style={{ padding: '0.25rem 0.75rem', border: 'none', background: showBase === 'B' ? '#3b82f6' : 'white', color: showBase === 'B' ? 'white' : '#64748b', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Modified
            </button>
          </div>
        </div>

        {/* Opacity Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Eye size={18} color="#64748b" />
          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Diff Opacity:</span>
          <input 
            type="range" 
            min="0" max="1" step="0.1" 
            value={diffOpacity} 
            onChange={(e) => setDiffOpacity(parseFloat(e.target.value))}
            style={{ width: '100px' }}
          />
        </div>
        
        {isProcessing && <span style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 500, marginLeft: 'auto' }}>Rendering Diff...</span>}
      </div>

      {/* Diff Canvas Area */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        
        {/* Hidden Work Canvases */}
        <canvas ref={canvasARef} style={{ display: 'none' }} />
        <canvas ref={canvasBRef} style={{ display: 'none' }} />
        
        <div style={{ position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)' }}>
          {/* Display Base Canvas */}
          <canvas ref={displayCanvasRef} style={{ display: 'block' }} />
          
          {/* Diff Overlay Canvas */}
          <canvas 
            ref={diffCanvasRef} 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              display: 'block',
              pointerEvents: 'none',
              opacity: diffOpacity,
              mixBlendMode: 'multiply'
            }} 
          />
        </div>
      </div>
    </div>
  );
}
