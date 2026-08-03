import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts, degrees, radians } from 'pdf-lib';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { RotateCw, ZoomIn, ZoomOut, MousePointer2, Type, Pen, Highlighter } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
};

const Thumbnail = ({ pageNum, pdfDoc, onClick, isActive, rotation }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    let renderTask = null;
    const renderThumb = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.2, rotation: page.rotate + rotation });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("Error rendering thumbnail:", err);
        }
      }
    };
    renderThumb();
    return () => {
      if (renderTask) renderTask.cancel();
    };
  }, [pdfDoc, pageNum, rotation]);
  
  return (
    <div 
      onClick={onClick} 
      style={{ 
        padding: '1rem', 
        cursor: 'pointer', 
        borderBottom: '1px solid #e2e8f0', 
        background: isActive ? '#eff6ff' : 'transparent', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: '0.5rem' 
      }}
    >
      <canvas 
        ref={canvasRef} 
        style={{ 
          maxWidth: '100%', 
          height: 'auto', 
          border: isActive ? '2px solid #3b82f6' : '1px solid #cbd5e1', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
        }} 
      />
      <span style={{ fontSize: '0.85rem', color: isActive ? '#1d4ed8' : '#64748b', fontWeight: isActive ? 600 : 400 }}>{pageNum}</span>
    </div>
  );
};

const PdfViewer = forwardRef(({ pdfUrl, file, activeTool = 'select', setActiveTool }, ref) => {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef(null);
  const [textLines, setTextLines] = useState([]);
  const [scale, setScale] = useState(1.5);
  
  const [editingId, setEditingId] = useState(null);
  const [edits, setEdits] = useState({});
  const [drawings, setDrawings] = useState({});
  const [currentStroke, setCurrentStroke] = useState(null);
  
  const sigInputRef = useRef(null);
  const [signatures, setSignatures] = useState({});
  const [uploadedSignatureUrl, setUploadedSignatureUrl] = useState(null);
  const [uploadedSignatureBytes, setUploadedSignatureBytes] = useState(null);

  const renderTaskRef = useRef(null);

  useImperativeHandle(ref, () => ({
    exportPdfBytes: async () => {
      console.log("[PdfViewer] exportPdfBytes called");
      if (!file) return null;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfLibDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfLibDoc.getPages();

        if (rotation !== 0) {
          pages.forEach(page => {
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees(currentRotation + rotation));
          });
        }

        // Apply Text Edits
        for (const [pageNumStr, pageEdits] of Object.entries(edits)) {
          const pageIndex = parseInt(pageNumStr) - 1;
          const page = pages[pageIndex];

          for (const edit of Object.values(pageEdits)) {
            const { line, newValue } = edit;
            const firstFrag = line.fragments[0];
            if (firstFrag && firstFrag.unscaledTransform) {
              const tx = firstFrag.unscaledTransform[4];
              const ty = firstFrag.unscaledTransform[5];
              const boxWidth = line.unscaledWidth;

              const [scaleX, skewY] = firstFrag.unscaledTransform;
              const fontSize = Math.sqrt(scaleX * scaleX + skewY * skewY);
              const angleRad = Math.atan2(skewY, scaleX);
              const boxHeight = line.unscaledHeight || fontSize;

              page.drawRectangle({
                x: tx - 1,
                y: ty - boxHeight * 0.2 - 1,
                width: boxWidth + 2,
                height: boxHeight + 2,
                color: rgb(1, 1, 1),
                rotate: radians(angleRad)
              });

              const helveticaFont = await pdfLibDoc.embedFont(StandardFonts.Helvetica);
              page.drawText(newValue, {
                x: tx,
                y: ty,
                size: fontSize,
                font: helveticaFont,
                color: rgb(0, 0, 0),
                rotate: radians(angleRad)
              });
            }
          }
        }

        // Apply Drawings (Freehand & Highlight)
        for (const [pageNumStr, pageDrawings] of Object.entries(drawings)) {
          const pageIndex = parseInt(pageNumStr) - 1;
          const page = pages[pageIndex];
          const pageHeight = page.getHeight();
          
          for (const stroke of pageDrawings) {
            page.drawSvgPath(stroke.path, {
              x: 0,
              y: pageHeight,
              borderColor: hexToRgb(stroke.color),
              borderWidth: stroke.thickness,
              borderOpacity: stroke.opacity,
            });
          }
        }

        // Apply Signatures
        for (const [pageNumStr, pageSigs] of Object.entries(signatures)) {
          const pageIndex = parseInt(pageNumStr) - 1;
          const page = pages[pageIndex];
          const pageHeight = page.getHeight();
          
          for (const sig of pageSigs) {
            let embeddedImage;
            if (sig.type === 'image/png') {
              embeddedImage = await pdfLibDoc.embedPng(sig.bytes);
            } else {
              embeddedImage = await pdfLibDoc.embedJpg(sig.bytes);
            }
            
            page.drawImage(embeddedImage, {
              x: sig.x,
              y: pageHeight - sig.y - sig.height,
              width: sig.width,
              height: sig.height
            });
          }
        }

        return await pdfLibDoc.save();
      } catch (err) {
        console.error("[PdfViewer] Export error:", err);
        throw err;
      }
    }
  }));

  useEffect(() => {
    const loadPdf = async () => {
      if (!file) return;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPageNumber(1);
        setRotation(0);
      } catch (err) {
        console.error("Error loading PDF:", err);
      }
    };
    loadPdf();
  }, [file]);

  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(pageNumber);
      // Removed auto-rotation bug logic. Now trusting native page.rotate + userRotation
      const viewport = page.getViewport({ scale, rotation: page.rotate + rotation });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const textContent = await page.getTextContent();
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = { canvasContext: context, viewport };
      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      
      await renderTask.promise;
      
      const rawFragments = textContent.items
        .filter(item => item.str !== undefined && item.transform !== undefined)
        .map((item) => {
          const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
          return {
            str: item.str,
            width: item.width * scale,
            height: item.height * scale,
            unscaledWidth: item.width,
            unscaledHeight: item.height,
            transform,
            unscaledTransform: item.transform,
            fontName: item.fontName,
          };
        });
      
      const sortedFragments = rawFragments.sort((a, b) => {
        const bandA = Math.round(a.transform[5] / 5);
        const bandB = Math.round(b.transform[5] / 5);
        if (bandA !== bandB) return bandA - bandB; 
        return a.transform[4] - b.transform[4];
      });

      const groupedLines = [];
      let currentLine = null;

      sortedFragments.forEach(frag => {
        if (!frag.str.trim() && !currentLine) return;
        
        if (!currentLine) {
          currentLine = {
            originalStr: frag.str,
            fragments: [frag],
            transform: frag.transform,
            width: frag.width,
            unscaledWidth: frag.unscaledWidth,
            fontName: frag.fontName
          };
          groupedLines.push(currentLine);
          return;
        }

        const prevFrag = currentLine.fragments[currentLine.fragments.length - 1];
        const prevY = prevFrag.transform[5];
        const fragY = frag.transform[5];
        const prevX = prevFrag.transform[4];
        const fragX = frag.transform[4];

        const isSameLine = Math.abs(prevY - fragY) <= 4;
        const distanceX = fragX - (prevX + prevFrag.width);
        const isCloseX = distanceX < 30;

        if (isSameLine && isCloseX) {
          if (distanceX > 3 && !prevFrag.str.endsWith(' ') && !frag.str.startsWith(' ')) {
            currentLine.originalStr += ' ';
          }
          currentLine.originalStr += frag.str;
          currentLine.fragments.push(frag);
          currentLine.width = (fragX + frag.width) - currentLine.transform[4];
          currentLine.unscaledWidth = (frag.unscaledTransform[4] + frag.unscaledWidth) - currentLine.fragments[0].unscaledTransform[4];
        } else {
          currentLine = {
            originalStr: frag.str,
            fragments: [frag],
            transform: frag.transform,
            width: frag.width,
            unscaledWidth: frag.unscaledWidth,
            fontName: frag.fontName
          };
          groupedLines.push(currentLine);
        }
      });
      
      setTextLines(groupedLines);
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error("Error rendering page:", err);
      }
    }
  }, [pdfDoc, pageNumber, scale, rotation]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Signature Handlers
  const handleSigUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const dataUrl = URL.createObjectURL(file);
    setUploadedSignatureUrl(dataUrl);
    setUploadedSignatureBytes({ bytes: arrayBuffer, type: file.type });
  };

  const handleCanvasClick = (e) => {
    if (activeTool !== 'sign') return;
    
    if (!uploadedSignatureUrl) {
      sigInputRef.current?.click();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    const width = 150; 
    const height = 50; 

    setSignatures(prev => {
      const pageSigs = prev[pageNumber] || [];
      return {
        ...prev,
        [pageNumber]: [
          ...pageSigs, 
          { 
            x: x - width/2, 
            y: y - height/2, 
            width, 
            height, 
            dataUrl: uploadedSignatureUrl, 
            bytes: uploadedSignatureBytes.bytes, 
            type: uploadedSignatureBytes.type 
          }
        ]
      };
    });
  };

  // Drawing Handlers
  const handlePointerDown = (e) => {
    if (activeTool === 'sign') return;
    if (activeTool !== 'draw' && activeTool !== 'highlight') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    const toolProps = activeTool === 'highlight' 
      ? { color: '#fbbf24', thickness: 16, opacity: 0.4, tool: 'highlight' }
      : { color: '#1a1a1a', thickness: 3, opacity: 1, tool: 'draw' };
      
    setCurrentStroke({
      ...toolProps,
      path: `M ${x} ${y}`,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!currentStroke) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    setCurrentStroke(prev => ({
      ...prev,
      path: `${prev.path} L ${x} ${y}`
    }));
  };

  const handlePointerUp = (e) => {
    if (!currentStroke) return;
    setDrawings(prev => {
      const pageDrawings = prev[pageNumber] || [];
      return {
        ...prev,
        [pageNumber]: [...pageDrawings, currentStroke]
      };
    });
    setCurrentStroke(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleTextClick = (index) => {
    if (activeTool === 'text') {
      setEditingId(index);
    }
  };

  const handleTextChange = (index, newValue) => {
    setEdits(prev => {
      const pageEdits = prev[pageNumber] || {};
      return {
        ...prev,
        [pageNumber]: {
          ...pageEdits,
          [index]: {
            line: textLines[index],
            newValue
          }
        }
      };
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const isTextTool = activeTool === 'text';

  return (
    <div style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', overflow: 'hidden' }}>
      
      {/* Left Sidebar Thumbnail Rail */}
      <div style={{ 
        width: '240px', 
        minWidth: '240px', 
        height: '100%', 
        overflowY: 'auto', 
        background: '#f8fafc', 
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {pdfDoc && Array.from({ length: numPages }, (_, i) => (
          <Thumbnail 
            key={i + 1} 
            pageNum={i + 1} 
            pdfDoc={pdfDoc} 
            isActive={pageNumber === i + 1} 
            onClick={() => setPageNumber(i + 1)}
            rotation={rotation}
          />
        ))}
      </div>

      {/* Main Centered Workspace */}
      <div style={{ flex: 1, backgroundColor: '#f3f4f6', overflow: 'auto', position: 'relative' }}>
        
        {/* Floating Toolbar */}
        <div style={{ 
          position: 'fixed', 
          bottom: '2rem', 
          left: 'calc(240px + (100vw - 240px) / 2)', 
          transform: 'translateX(-50%)',
          display: 'flex', 
          alignItems: 'center',
          gap: '0.25rem', 
          background: 'white', 
          padding: '0.5rem', 
          borderRadius: '9999px', 
          border: '1px solid var(--border-color)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          zIndex: 100
        }}>
          {setActiveTool && (
            <>
              <button className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')} title="Select">
                <MousePointer2 size={18} />
              </button>
              <button className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => setActiveTool('text')} title="Edit Text">
                <Type size={18} />
              </button>
              <button className={`tool-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => setActiveTool('draw')} title="Draw">
                <Pen size={18} />
              </button>
              <button className={`tool-btn ${activeTool === 'highlight' ? 'active' : ''}`} onClick={() => setActiveTool('highlight')} title="Highlight">
                <Highlighter size={18} />
              </button>
              <button className={`tool-btn ${activeTool === 'sign' ? 'active' : ''}`} onClick={() => setActiveTool('sign')} title="Sign">
                <Pen size={18} color={activeTool === 'sign' ? 'inherit' : '#10b981'} />
              </button>
              <div className="toolbar-divider" />
            </>
          )}

          <button onClick={() => setScale(p => Math.max(0.5, p - 0.25))} className="tool-btn" title="Zoom Out">
            <ZoomOut size={18} />
          </button>
          <span style={{ display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '0.9rem', width: '45px', justifyContent: 'center', userSelect: 'none' }}>
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => setScale(p => Math.min(3, p + 0.25))} className="tool-btn" title="Zoom In">
            <ZoomIn size={18} />
          </button>
          <div className="toolbar-divider" />
          <button onClick={() => setRotation(prev => (prev + 90) % 360)} className="tool-btn" title="Rotate">
            <RotateCw size={18} /> 
          </button>
        </div>

        {/* Scrollable Canvas Container Wrapper */}
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100%', padding: '2rem 0 6rem 0', boxSizing: 'border-box' }}>
          
          <div className="pdf-page-container" onClick={handleCanvasClick} style={{ 
            cursor: activeTool === 'sign' ? 'crosshair' : 'default',
            margin: '0 auto', 
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            backgroundColor: 'white',
            position: 'relative',
            height: 'fit-content'
          }}>
            <canvas ref={canvasRef} className="pdf-canvas" style={{ display: 'block' }} />
            
            {/* Signatures Layer */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 15 }}>
              {(signatures[pageNumber] || []).map((sig, i) => (
                <img 
                  key={i} 
                  src={sig.dataUrl} 
                  style={{
                    position: 'absolute',
                    left: `${sig.x * scale}px`,
                    top: `${sig.y * scale}px`,
                    width: `${sig.width * scale}px`,
                    height: `${sig.height * scale}px`,
                    pointerEvents: 'auto',
                    border: '1px dashed rgba(0,0,0,0.2)'
                  }}
                  alt="Signature"
                />
              ))}
            </div>
            
            <input 
              type="file"
              ref={sigInputRef}
              onChange={handleSigUpload}
              accept="image/png, image/jpeg"
              style={{ display: 'none' }}
            />
            
            {/* Drawing Layer */}
            <svg 
              className={`drawing-layer ${activeTool === 'draw' || activeTool === 'highlight' ? 'active' : ''}`}
              width={canvasRef.current?.width || 0}
              height={canvasRef.current?.height || 0}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              style={{ touchAction: 'none', position: 'absolute', top: 0, left: 0 }}
            >
              <g transform={`scale(${scale})`}>
                {(drawings[pageNumber] || []).map((stroke, i) => (
                  <path 
                    key={i} 
                    d={stroke.path} 
                    stroke={stroke.color} 
                    strokeWidth={stroke.thickness} 
                    fill="none" 
                    strokeOpacity={stroke.opacity} 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    style={stroke.tool === 'highlight' ? { mixBlendMode: 'multiply' } : {}}
                  />
                ))}
                {currentStroke && (
                  <path 
                    d={currentStroke.path} 
                    stroke={currentStroke.color} 
                    strokeWidth={currentStroke.thickness} 
                    fill="none" 
                    strokeOpacity={currentStroke.opacity} 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={currentStroke.tool === 'highlight' ? { mixBlendMode: 'multiply' } : {}}
                  />
                )}
              </g>
            </svg>

            {/* Text Layer */}
            <div className="text-layer" style={{ width: canvasRef.current?.width, height: canvasRef.current?.height, position: 'absolute', top: 0, left: 0 }}>
              {textLines.map((line, index) => {
                const [scaleX, skewY, skewX, scaleY, tx, ty] = line.transform;
                const fontSize = Math.sqrt(scaleX * scaleX + skewY * skewY);
                const angle = Math.atan2(skewY, scaleX) * (180 / Math.PI);

                const isEditing = editingId === index;
                const pageEdits = edits[pageNumber] || {};
                const currentText = pageEdits[index] ? pageEdits[index].newValue : line.originalStr;
                
                if (!currentText.trim() && !isEditing && !line.originalStr.trim()) return null;

                const isEdited = currentText !== line.originalStr;

                const style = {
                  position: 'absolute',
                  left: `${tx}px`,
                  top: `${ty - fontSize}px`,
                  fontFamily: isEdited ? 'Helvetica, sans-serif' : line.fontName,
                  fontSize: `${fontSize}px`,
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: '0% 100%',
                  lineHeight: 1,
                  whiteSpace: 'pre',
                  color: isEdited ? 'black' : undefined,
                  backgroundColor: isEdited ? 'white' : undefined,
                  minWidth: isEdited ? `${line.width}px` : 'auto',
                  cursor: isTextTool ? 'text' : 'default',
                  pointerEvents: isTextTool ? 'auto' : 'none'
                };

                if (isEditing) {
                  return (
                    <input
                      key={index}
                      autoFocus
                      className="editing-node"
                      style={{ 
                        ...style, 
                        color: 'black',
                        backgroundColor: 'white',
                        pointerEvents: 'auto',
                        minWidth: `${Math.max(line.width, 50)}px`,
                        width: `${currentText.length + 1}ch` 
                      }} 
                      value={currentText}
                      onChange={(e) => handleTextChange(index, e.target.value)}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={handleKeyDown}
                    />
                  );
                }

                return (
                  <span
                    key={index}
                    style={style}
                    onClick={() => handleTextClick(index)}
                  >
                    {currentText}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PdfViewer;
