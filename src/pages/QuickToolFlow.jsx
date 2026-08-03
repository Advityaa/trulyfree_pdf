import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileUp, ArrowLeft, Lock, File as FileIcon, X, ArrowUp, ArrowDown, SplitSquareVertical, Minimize } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import '../App.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export default function QuickToolFlow() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Steps: 1 = select, 2 = configure, 3 = processing, 4 = done
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([]);
  
  // Tool specific configurations
  const [password, setPassword] = useState('');
  const [pageRange, setPageRange] = useState('');
  
  // Output
  const [outputUrl, setOutputUrl] = useState(null);
  const [outputFileName, setOutputFileName] = useState('');

  const toolTitle = toolId ? toolId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Tool';

  const handleFileUpload = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const pdfFiles = selectedFiles.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length > 0) {
      if (toolId !== 'merge' && files.length > 0) {
        setFiles([pdfFiles[0]]); // enforce single select for non-merge
      } else {
        setFiles(prev => [...prev, ...pdfFiles]);
      }
      setStep(2);
    } else {
      alert("That file isn't a pdf. Choose a pdf file to continue.");
    }
  };

  const handleRemoveFile = (indexToRemove) => {
    setFiles(prev => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      if (updated.length === 0) setStep(1);
      return updated;
    });
  };

  const moveFile = (index, direction) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (direction === -1 && index > 0) {
        [newFiles[index], newFiles[index - 1]] = [newFiles[index - 1], newFiles[index]];
      } else if (direction === 1 && index < newFiles.length - 1) {
        [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
      }
      return newFiles;
    });
  };

  const handleProcess = async () => {
    setStep(3);
    
    try {
      if (toolId === 'merge') {
        const mergedPdf = await PDFDocument.create();
        for (const file of files) {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
        const pdfBytes = await mergedPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        setOutputUrl(URL.createObjectURL(blob));
        setOutputFileName('merged_document.pdf');
      } 
      else if (toolId === 'split' || toolId === 'remove') {
        const file = files[0];
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const totalPages = pdfDoc.getPageCount();
        
        let pagesToProcess = new Set();
        if (!pageRange.trim()) {
           if (toolId === 'split') {
             for(let i=0; i<totalPages; i++) pagesToProcess.add(i);
           }
        } else {
          const parts = pageRange.split(',');
          for (let part of parts) {
            part = part.trim();
            if (part.includes('-')) {
              const [start, end] = part.split('-').map(Number);
              if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) {
                  if (i >= 1 && i <= totalPages) pagesToProcess.add(i - 1);
                }
              }
            } else {
              const pageNum = Number(part);
              if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                pagesToProcess.add(pageNum - 1);
              }
            }
          }
        }

        let sortedPages = [];
        if (toolId === 'split') {
          sortedPages = Array.from(pagesToProcess).sort((a,b) => a-b);
        } else { // remove
          for(let i=0; i<totalPages; i++) {
             if (!pagesToProcess.has(i)) sortedPages.push(i);
          }
        }

        const newPdf = await PDFDocument.create();
        if (sortedPages.length === 0) throw new Error("No valid pages selected.");
        
        const copiedPages = await newPdf.copyPages(pdfDoc, sortedPages);
        copiedPages.forEach((page) => newPdf.addPage(page));
        
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        setOutputUrl(URL.createObjectURL(blob));
        setOutputFileName(`${toolId}_${file.name}`);
      }
      else if (toolId === 'compress') {
        const file = files[0];
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        setOutputUrl(URL.createObjectURL(blob));
        setOutputFileName(`compressed_${file.name}`);
      }
      else if (toolId === 'ocr') {
        const file = files[0];
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = "";
        
        for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 3); pageNum++) { // Cap at 3 for demo
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d');
          await page.render({ canvasContext: context, viewport }).promise;
          
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
          
          const formData = new FormData();
          formData.append('file', blob, `page_${pageNum}.jpg`);
          
          try {
            const response = await fetch('http://localhost:8000/api/ocr', {
              method: 'POST',
              body: formData
            });
            const result = await response.json();
            if (result.success) {
              fullText += `--- Page ${pageNum} ---\n${result.text}\n\n`;
            }
          } catch (e) {
            console.error("OCR API Error:", e);
            throw new Error("Ensure the Python OCR backend is running on port 8000.");
          }
        }
        
        const txtBlob = new Blob([fullText], { type: 'text/plain' });
        setOutputUrl(URL.createObjectURL(txtBlob));
        setOutputFileName(`ocr_${file.name}.txt`);
      }
      else if (toolId === 'pdf-to-jpg') {
        const file = files[0];
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        // Convert first page for MVP
        const page = await pdf.getPage(1); 
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        setOutputUrl(URL.createObjectURL(blob));
        setOutputFileName(`${file.name.replace('.pdf', '')}_page1.jpg`);
      }
      else {
        // Fallback for tools not yet implemented
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      setStep(4);
    } catch (error) {
      alert("Processing failed: " + error.message);
      setStep(2);
    }
  };

  const handleDownload = () => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = outputFileName || 'processed.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getIsDisabled = () => {
    if (step === 3) return true;
    if (toolId === 'protect' && !password) return true;
    if (toolId === 'merge' && files.length < 2) return true; 
    return false;
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', padding: '1.5rem 2rem', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', padding: 0, color: '#171717', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={20} />
          <span style={{ fontWeight: 500 }}>Back</span>
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: '1.2rem', color: '#171717' }}>
          {toolTitle}
        </div>
        <div style={{ width: '60px' }}></div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 2rem' }}>
        
        {step === 1 && (
          <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 600, textAlign: 'center', color: '#171717' }}>Select PDF file</h1>
            <div 
              className="upload-overlay glass-panel" 
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="upload-icon" />
              <h2 style={{ fontSize: '1.25rem', color: '#171717', marginBottom: '0.5rem' }}>Drop your pdf here or browse files</h2>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".pdf" 
                multiple={toolId === 'merge'} 
                className="hidden-input"
              />
            </div>
            {toolId === 'merge' && (
              <p style={{ textAlign: 'center', color: '#64748b' }}>Select multiple files to merge them together.</p>
            )}
          </div>
        )}

        {(step === 2 || step === 3) && (
          <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* File Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {files.map((f, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflow: 'hidden' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '8px' }}>
                      <FileIcon size={24} color="#3b82f6" />
                    </div>
                    <span style={{ fontWeight: 500, color: '#171717', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{f.name}</span>
                  </div>
                  {step === 2 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {toolId === 'merge' && (
                        <>
                          <button onClick={() => moveFile(idx, -1)} disabled={idx === 0} style={{ background: 'transparent', border: 'none', padding: '0.5rem', color: idx === 0 ? '#cbd5e1' : '#64748b', cursor: idx === 0 ? 'default' : 'pointer' }} title="Move Up">
                            <ArrowUp size={20} />
                          </button>
                          <button onClick={() => moveFile(idx, 1)} disabled={idx === files.length - 1} style={{ background: 'transparent', border: 'none', padding: '0.5rem', color: idx === files.length - 1 ? '#cbd5e1' : '#64748b', cursor: idx === files.length - 1 ? 'default' : 'pointer' }} title="Move Down">
                            <ArrowDown size={20} />
                          </button>
                        </>
                      )}
                      <button onClick={() => handleRemoveFile(idx)} style={{ background: 'transparent', border: 'none', padding: '0.5rem', color: '#ef4444', cursor: 'pointer' }} title="Remove">
                        <X size={20} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {toolId === 'merge' && step === 2 && (
               <button onClick={() => fileInputRef.current?.click()} style={{ alignSelf: 'center', background: 'transparent', border: 'none', color: '#3b82f6', fontWeight: 500, cursor: 'pointer' }}>
                  + Add more files
               </button>
            )}

            {/* Split / Remove Configuration */}
            {(toolId === 'split' || toolId === 'remove') && step === 2 && (
              <div style={{ padding: '2rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#171717', margin: 0 }}>{toolId === 'split' ? 'Extract Pages' : 'Remove Pages'}</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                  {toolId === 'split' 
                    ? 'Enter page numbers to extract (e.g. 1, 3-5). Leave blank to keep all.' 
                    : 'Enter page numbers to remove (e.g. 1, 3-5). Leave blank to keep all.'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f9fafb', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <SplitSquareVertical size={18} color="#94a3b8" />
                  <input 
                    type="text" 
                    placeholder="e.g. 1, 3-5, 9" 
                    value={pageRange}
                    onChange={(e) => setPageRange(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '1rem', color: '#171717' }}
                  />
                </div>
              </div>
            )}

            {/* Protect Configuration */}
            {toolId === 'protect' && step === 2 && (
              <div style={{ padding: '2rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#171717', margin: 0 }}>Protect PDF</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Add a password to prevent unauthorized access.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f9fafb', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <Lock size={18} color="#94a3b8" />
                  <input 
                    type="password" 
                    placeholder="Type password..." 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '1rem', color: '#171717' }}
                  />
                </div>
              </div>
            )}

            {/* Compress Configuration */}
            {toolId === 'compress' && step === 2 && (
              <div style={{ padding: '2rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#171717', margin: 0 }}>Compress PDF</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Choose a compression level to shrink file size.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#171717' }}>
                     <input type="radio" name="compression" defaultChecked /> 
                     <div>
                       <strong>Recommended Compression</strong>
                       <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Good quality and file size balance.</div>
                     </div>
                   </label>
                   <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#171717' }}>
                     <input type="radio" name="compression" /> 
                     <div>
                       <strong>Extreme Compression</strong>
                       <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Less quality, high compression.</div>
                     </div>
                   </label>
                </div>
              </div>
            )}

            {/* Generic Configuration for other tools */}
            {toolId !== 'protect' && toolId !== 'merge' && toolId !== 'split' && toolId !== 'remove' && toolId !== 'compress' && toolId !== 'ocr' && toolId !== 'pdf-to-jpg' && step === 2 && (
              <div style={{ padding: '2rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'center', color: '#64748b' }}>
                Configuration options for {toolTitle} would appear here.
              </div>
            )}
            
            {toolId === 'pdf-to-jpg' && step === 2 && (
              <div style={{ padding: '2rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'center', color: '#171717' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Convert to JPG</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>This will render the first page of your PDF into a high-quality JPG image.</p>
              </div>
            )}
            
            {toolId === 'ocr' && step === 2 && (
              <div style={{ padding: '2rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'center', color: '#171717' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Extract Text</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>This will run EasyOCR on your document and generate a text file. (Demo limited to first 3 pages).</p>
              </div>
            )}

            <button 
              className="btn-primary" 
              onClick={handleProcess} 
              disabled={getIsDisabled()}
              style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1.1rem' }}
            >
              {step === 3 ? 'Processing...' : `${toolTitle} PDF`}
            </button>
            
            {/* Hidden input for adding more files in merge */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".pdf" 
              multiple={toolId === 'merge'} 
              className="hidden-input"
            />
          </div>
        )}

        {step === 4 && (
          <div style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center', textAlign: 'center', padding: '3rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: '24px' }}>
            <div style={{ background: '#ecfdf5', color: '#10b981', padding: '1rem', borderRadius: '50%' }}>
              <FileUp size={48} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#171717', marginBottom: '0.5rem' }}>Task complete!</h2>
              <p style={{ color: '#64748b' }}>Your PDF has been successfully processed.</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
              <button className="btn-primary" onClick={handleDownload} style={{ width: '100%', justifyContent: 'center', padding: '1rem' }}>
                Download {toolId === 'ocr' ? 'Text File' : (toolId === 'pdf-to-jpg' ? 'JPG Image' : 'PDF')}
              </button>
              <button onClick={() => { setStep(1); setFiles([]); setOutputUrl(null); }} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 500 }}>
                Start another
              </button>
            </div>
            
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '1rem' }}>
              Files are processed locally in your browser. No data leaves your device.
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
