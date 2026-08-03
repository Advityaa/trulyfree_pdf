import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts, degrees, radians } from 'pdf-lib';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { RotateCw, ZoomIn, ZoomOut, MousePointer2, Type, Pen, Highlighter, Shield, CheckSquare, Stamp, Lock, X } from 'lucide-react';
import { usePinch } from '@use-gesture/react';

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
  const [annotations, setAnnotations] = useState({});
  const [currentAnnotation, setCurrentAnnotation] = useState(null);
  
  const [redactions, setRedactions] = useState({});
  const [currentRedaction, setCurrentRedaction] = useState(null);
  const [currentViewport, setCurrentViewport] = useState(null);
  
  const sigInputRef = useRef(null);
  const [signatures, setSignatures] = useState({});
  const [uploadedSignatureUrl, setUploadedSignatureUrl] = useState(null);
  const [uploadedSignatureBytes, setUploadedSignatureBytes] = useState(null);

  const [existingFormFields, setExistingFormFields] = useState([]);
  const [formValues, setFormValues] = useState({});
  const [newFormFields, setNewFormFields] = useState({});
  const [currentNewField, setCurrentNewField] = useState(null);

  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false);
  const [watermarkConfig, setWatermarkConfig] = useState({
    enabled: false,
    mode: 'text',
    text: 'CONFIDENTIAL',
    fontSize: 48,
    imageData: null,
    imageType: null,
    opacity: 0.3,
    rotationDeg: 45,
    tiled: false,
    tileSpacing: 100,
    pageRange: 'all',
  });
  const [watermarkImageUrl, setWatermarkImageUrl] = useState(null);

  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityConfig, setSecurityConfig] = useState({
    enabled: false,
    userPassword: '',
    ownerPassword: '',
    permissions: {
      printing: 'highResolution',
      modifying: true,
      copying: true,
      annotating: true,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: true
    }
  });

  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [encryptedFileBytes, setEncryptedFileBytes] = useState(null);

  useEffect(() => {
    if (watermarkConfig.imageData && watermarkConfig.imageType) {
      const blob = new Blob([watermarkConfig.imageData], { type: watermarkConfig.imageType });
      const url = URL.createObjectURL(blob);
      setWatermarkImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [watermarkConfig.imageData, watermarkConfig.imageType]);

  const bindPinch = usePinch(({ offset: [d] }) => {
    // scale is usually d, we start at the current scale, but usePinch offset gives absolute scale if configured
    // Since we don't configure bounds here easily, let's just do delta
  }, { 
    // Wait, usePinch offset gives distance. It's better to use `movement` or `memo` 
    // Actually, just changing scale on delta is simpler
  });
  // Actually, let's use the full usePinch correctly
  const pinchBind = usePinch(state => {
    if (state.first) {
      state.memo = scale;
    }
    const newScale = Math.max(0.5, Math.min(3, state.memo * state.movement[0]));
    setScale(newScale);
    return state.memo;
  });

  const renderTaskRef = useRef(null);

  useEffect(() => {
    const parseForm = async () => {
      if (!file) return;
      try {
        const arrayBuffer = encryptedFileBytes || await file.arrayBuffer();
        if (!encryptedFileBytes) setEncryptedFileBytes(arrayBuffer);

        let doc;
        try {
          doc = await PDFDocument.load(arrayBuffer, { password: unlockPassword || undefined, ignoreEncryption: !unlockPassword });
          if (doc.isEncrypted && !unlockPassword) {
            setIsUnlockModalOpen(true);
            return;
          }
        } catch (e) {
          if (e.message?.toLowerCase().includes('password') || e.name === 'EncryptedPDFError') {
            setIsUnlockModalOpen(true);
            return;
          }
          throw e;
        }

        const form = doc.getForm();
        if (!form) return;
        
        const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer, password: unlockPassword || undefined }).promise;
        const parsedFields = [];
        const initialValues = {};
        
        for (let i = 1; i <= pdfjsDoc.numPages; i++) {
          const page = await pdfjsDoc.getPage(i);
          const annots = await page.getAnnotations();
          
          for (const annot of annots) {
            if (annot.fieldType) {
              const name = annot.fieldName;
              
              if (!initialValues.hasOwnProperty(name)) {
                initialValues[name] = annot.fieldValue || '';
              }
              
              parsedFields.push({
                name,
                type: annot.fieldType, // 'Tx', 'Btn', 'Ch', etc.
                pageNum: i,
                pdfX: annot.rect[0],
                pdfY: annot.rect[1],
                pdfW: annot.rect[2] - annot.rect[0],
                pdfH: annot.rect[3] - annot.rect[1],
                options: annot.options || [],
                flags: annot.fieldFlags || 0,
              });
            }
          }
        }
        
        setExistingFormFields(parsedFields);
        setFormValues(initialValues);
      } catch (err) {
         console.warn("Could not parse form", err);
      }
    };
    parseForm();
  }, [file]);

  useImperativeHandle(ref, () => ({
    exportPdfBytes: async () => {
      console.log("[PdfViewer] exportPdfBytes called");
      if (!file) return null;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfLibDoc = await PDFDocument.load(arrayBuffer);
        let pages = pdfLibDoc.getPages();

        // Apply True Redaction (Rasterization)
        for (const [pageNumStr, pageRedacts] of Object.entries(redactions)) {
          if (!pageRedacts || pageRedacts.length === 0) continue;
          
          const pageNum = parseInt(pageNumStr);
          const pageIndex = pageNum - 1;
          const originalPage = pages[pageIndex];

          // 1. Render page to high-res unrotated canvas
          const pdfjsPage = await pdfDoc.getPage(pageNum);
          const unrotatedViewport = pdfjsPage.getViewport({ scale: 3.0, rotation: 0 });
          
          const canvas = document.createElement('canvas');
          canvas.width = unrotatedViewport.width;
          canvas.height = unrotatedViewport.height;
          const context = canvas.getContext('2d');
          
          await pdfjsPage.render({ canvasContext: context, viewport: unrotatedViewport }).promise;

          // 2. Draw black redaction boxes in unrotated space
          context.fillStyle = 'black';
          for (const redact of pageRedacts) {
            const pt1 = unrotatedViewport.convertToViewportPoint(redact.pdfX, redact.pdfY);
            const pt2 = unrotatedViewport.convertToViewportPoint(redact.pdfX + redact.pdfW, redact.pdfY + redact.pdfH);
            
            const rx = Math.min(pt1[0], pt2[0]);
            const ry = Math.min(pt1[1], pt2[1]);
            const rw = Math.abs(pt1[0] - pt2[0]);
            const rh = Math.abs(pt1[1] - pt2[1]);
            
            context.fillRect(rx, ry, rw, rh);
          }

          // 3. Convert to JPEG
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
          const arrayBuffer = await blob.arrayBuffer();
          const image = await pdfLibDoc.embedJpg(arrayBuffer);

          // 4. Rebuild page with exact same coordinate system
          pdfLibDoc.removePage(pageIndex);
          const baseViewport = pdfjsPage.getViewport({ scale: 1.0, rotation: 0 });
          const newPage = pdfLibDoc.insertPage(pageIndex, [baseViewport.width, baseViewport.height]);
          newPage.setRotation(degrees(pdfjsPage.rotate));
          
          // 5. Draw the flattened image
          newPage.drawImage(image, {
             x: 0,
             y: 0,
             width: baseViewport.width,
             height: baseViewport.height
          });
        }

        // Refresh pages array after structural changes
        pages = pdfLibDoc.getPages();

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

        // Apply Annotations
        for (const [pageNumStr, pageAnnots] of Object.entries(annotations)) {
          const pageIndex = parseInt(pageNumStr) - 1;
          const page = pages[pageIndex];
          
          for (const annot of pageAnnots) {
            if (annot.type === 'ink' || annot.type === 'highlight') {
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              const inkList = annot.inkList.map(pts => {
                 const arr = [];
                 for(let i=0; i<pts.length; i+=2) {
                    minX = Math.min(minX, pts[i]);
                    minY = Math.min(minY, pts[i+1]);
                    maxX = Math.max(maxX, pts[i]);
                    maxY = Math.max(maxY, pts[i+1]);
                    arr.push(pdfLibDoc.context.obj(pts[i]), pdfLibDoc.context.obj(pts[i+1]));
                 }
                 return pdfLibDoc.context.obj(arr);
              });
              
              const rgbColor = hexToRgb(annot.color);
              
              const dict = pdfLibDoc.context.obj({
                Type: 'Annot',
                Subtype: 'Ink',
                Rect: [minX - annot.thickness, minY - annot.thickness, maxX + annot.thickness, maxY + annot.thickness],
                InkList: inkList,
                C: [rgbColor.red, rgbColor.green, rgbColor.blue],
                BS: pdfLibDoc.context.obj({ Type: 'Border', S: 'S', W: annot.thickness }),
                CA: annot.opacity
              });
              
              const annotRef = pdfLibDoc.context.register(dict);
              page.node.addAnnot(annotRef);
            }
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

        // Apply Form Fields
        const form = pdfLibDoc.getForm();
        if (form) {
          // Inject New Form Fields
          for (const [pageNumStr, pageFields] of Object.entries(newFormFields)) {
            const pageIndex = parseInt(pageNumStr) - 1;
            const page = pages[pageIndex];
            
            for (const field of pageFields) {
              try {
                if (field.type === 'Tx') {
                  const f = form.createTextField(field.name);
                  f.addToPage(page, { x: field.pdfX, y: field.pdfY, width: field.pdfW, height: field.pdfH });
                } else if (field.type === 'Btn') {
                  const f = form.createCheckBox(field.name);
                  f.addToPage(page, { x: field.pdfX, y: field.pdfY, width: field.pdfW, height: field.pdfH });
                }
              } catch (e) {
                 console.warn("Could not create field", e);
              }
            }
          }

          for (const [name, value] of Object.entries(formValues)) {
            try {
              const field = form.getField(name);
              if (field) {
                 const type = field.constructor.name;
                 if (type === 'PDFTextField') field.setText(value);
                 else if (type === 'PDFCheckBox') {
                    if (value) field.check();
                    else field.uncheck();
                 }
                 else if (type === 'PDFDropdown') field.select(value);
                 else if (type === 'PDFRadioGroup') field.select(value);
              }
            } catch(e) {}
          }
          // form.flatten(); // Could be optional, not flattening allows editing later
        }

        // Apply Watermark
        if (watermarkConfig.enabled) {
          let targetPages = [];
          if (watermarkConfig.pageRange === 'all') {
            targetPages = pages;
          } else if (watermarkConfig.pageRange === 'current') {
            targetPages = [pages[pageNumber - 1]];
          } else {
            targetPages = pages;
          }

          let embeddedImage = null;
          if (watermarkConfig.mode === 'image' && watermarkConfig.imageData) {
            if (watermarkConfig.imageType === 'image/png') {
              embeddedImage = await pdfLibDoc.embedPng(watermarkConfig.imageData);
            } else {
              embeddedImage = await pdfLibDoc.embedJpg(watermarkConfig.imageData);
            }
          }

          const helveticaFont = await pdfLibDoc.embedFont(StandardFonts.Helvetica);

          targetPages.forEach(page => {
            const { width, height } = page.getSize();
            const { mode, text, fontSize, opacity, rotationDeg, tiled, tileSpacing } = watermarkConfig;
            
            const drawContent = (x, y) => {
              if (mode === 'text' && text) {
                const textWidth = helveticaFont.widthOfTextAtSize(text, fontSize);
                const textHeight = helveticaFont.heightAtSize(fontSize);
                page.drawText(text, {
                  x: x - textWidth / 2, 
                  y: y - textHeight / 2,
                  size: fontSize,
                  font: helveticaFont,
                  opacity,
                  rotate: degrees(rotationDeg),
                  color: rgb(0.2, 0.2, 0.2)
                });
              } else if (mode === 'image' && embeddedImage) {
                 const scaleFactor = 300 / embeddedImage.width;
                 const finalWidth = embeddedImage.width * scaleFactor;
                 const finalHeight = embeddedImage.height * scaleFactor;
                 page.drawImage(embeddedImage, {
                    x: x - finalWidth / 2, 
                    y: y - finalHeight / 2,
                    width: finalWidth,
                    height: finalHeight,
                    opacity,
                    rotate: degrees(rotationDeg)
                 });
              }
            };

            if (!tiled) {
              drawContent(width / 2, height / 2);
            } else {
              const spacing = tileSpacing + 150; 
              for (let x = -width; x < width * 2; x += spacing) {
                for (let y = -height; y < height * 2; y += spacing) {
                  drawContent(x, y);
                }
              }
            }
          });
        }
        // Apply Encryption
        if (securityConfig.enabled) {
          const encOpts = { permissions: securityConfig.permissions };
          if (securityConfig.userPassword) encOpts.userPassword = securityConfig.userPassword;
          if (securityConfig.ownerPassword) encOpts.ownerPassword = securityConfig.ownerPassword;
          pdfLibDoc.encrypt(encOpts);
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
        const arrayBuffer = encryptedFileBytes || await file.arrayBuffer();
        if (!encryptedFileBytes) setEncryptedFileBytes(arrayBuffer);

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, password: unlockPassword || undefined });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPageNumber(1);
        setRotation(0);
        setIsUnlockModalOpen(false); // successfully unlocked
      } catch (err) {
        if (err.name === 'PasswordException') {
          setIsUnlockModalOpen(true);
        } else {
          console.error("Error loading PDF:", err);
        }
      }
    };
    loadPdf();
  }, [file, unlockPassword, encryptedFileBytes]);

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
      setCurrentViewport(viewport);
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const textContent = await page.getTextContent();
      
      const dpr = window.devicePixelRatio || 1;
      canvas.height = viewport.height * dpr;
      canvas.width = viewport.width * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const renderContext = { 
        canvasContext: context, 
        viewport,
        transform: [dpr, 0, 0, dpr, 0, 0]
      };
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
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (activeTool === 'redact') {
      setCurrentRedaction({ x, y, width: 0, height: 0 });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (activeTool === 'form') {
      setCurrentNewField({ x, y, width: 0, height: 0 });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (activeTool !== 'draw' && activeTool !== 'highlight') return;
    
    if (!currentViewport) return;
    
    const toolProps = activeTool === 'highlight' 
      ? { color: '#fbbf24', thickness: 16, opacity: 0.4, type: 'highlight' }
      : { color: '#1a1a1a', thickness: 3, opacity: 1, type: 'ink' };
      
    const pdfPt = currentViewport.convertToPdfPoint(e.clientX - rect.left, e.clientY - rect.top);
      
    setCurrentAnnotation({
      id: `annot_${Date.now()}`,
      ...toolProps,
      inkList: [[pdfPt[0], pdfPt[1]]],
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (activeTool === 'redact' && currentRedaction) {
      setCurrentRedaction(prev => ({
        ...prev,
        width: x - prev.x,
        height: y - prev.y
      }));
      return;
    }

    if (activeTool === 'form' && currentNewField) {
      setCurrentNewField(prev => ({
        ...prev,
        width: x - prev.x,
        height: y - prev.y
      }));
      return;
    }

    if (!currentAnnotation || !currentViewport) return;
    
    const pdfPt = currentViewport.convertToPdfPoint(e.clientX - rect.left, e.clientY - rect.top);
    
    setCurrentAnnotation(prev => ({
      ...prev,
      inkList: [[...prev.inkList[0], pdfPt[0], pdfPt[1]]]
    }));
  };

  const handlePointerUp = (e) => {
    if (activeTool === 'redact' && currentRedaction) {
      // Normalize width/height to be positive in unscaled canvas space
      const normX = currentRedaction.width < 0 ? currentRedaction.x + currentRedaction.width : currentRedaction.x;
      const normY = currentRedaction.height < 0 ? currentRedaction.y + currentRedaction.height : currentRedaction.y;
      const normW = Math.abs(currentRedaction.width);
      const normH = Math.abs(currentRedaction.height);
      
      if (normW > 5 && normH > 5 && currentViewport) { // Minimum size
        // Convert to PDF native coordinates (bottom-left origin, unscaled, unrotated)
        const pdfPt1 = currentViewport.convertToPdfPoint(normX * scale, normY * scale);
        const pdfPt2 = currentViewport.convertToPdfPoint((normX + normW) * scale, (normY + normH) * scale);
        
        const pdfX = Math.min(pdfPt1[0], pdfPt2[0]);
        const pdfY = Math.min(pdfPt1[1], pdfPt2[1]);
        const pdfW = Math.abs(pdfPt1[0] - pdfPt2[0]);
        const pdfH = Math.abs(pdfPt1[1] - pdfPt2[1]);

        setRedactions(prev => ({
          ...prev,
          [pageNumber]: [...(prev[pageNumber] || []), { pdfX, pdfY, pdfW, pdfH }]
        }));
      }
      setCurrentRedaction(null);
      e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }

    if (activeTool === 'form' && currentNewField) {
      const normX = currentNewField.width < 0 ? currentNewField.x + currentNewField.width : currentNewField.x;
      const normY = currentNewField.height < 0 ? currentNewField.y + currentNewField.height : currentNewField.y;
      const normW = Math.abs(currentNewField.width);
      const normH = Math.abs(currentNewField.height);
      
      if (normW > 10 && normH > 10 && currentViewport) { 
        const pdfPt1 = currentViewport.convertToPdfPoint(normX * scale, normY * scale);
        const pdfPt2 = currentViewport.convertToPdfPoint((normX + normW) * scale, (normY + normH) * scale);
        
        const pdfX = Math.min(pdfPt1[0], pdfPt2[0]);
        const pdfY = Math.min(pdfPt1[1], pdfPt2[1]);
        const pdfW = Math.abs(pdfPt1[0] - pdfPt2[0]);
        const pdfH = Math.abs(pdfPt1[1] - pdfPt2[1]);

        const id = `field_${Date.now()}`;
        setNewFormFields(prev => ({
          ...prev,
          [pageNumber]: [...(prev[pageNumber] || []), { id, name: id, type: 'Tx', pdfX, pdfY, pdfW, pdfH }]
        }));
      }
      setCurrentNewField(null);
      e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }

    if (!currentAnnotation) return;
    setAnnotations(prev => {
      const pageAnnots = prev[pageNumber] || [];
      return {
        ...prev,
        [pageNumber]: [...pageAnnots, currentAnnotation]
      };
    });
    setCurrentAnnotation(null);
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
              <button className={`tool-btn ${activeTool === 'redact' ? 'active' : ''}`} onClick={() => setActiveTool('redact')} title="Redact">
                <Shield size={18} />
              </button>
              <button className={`tool-btn ${activeTool === 'form' ? 'active' : ''}`} onClick={() => setActiveTool('form')} title="Form Field">
                <CheckSquare size={18} />
              </button>
              <button className={`tool-btn ${activeTool === 'sign' ? 'active' : ''}`} onClick={() => setActiveTool('sign')} title="Sign">
                <Pen size={18} color={activeTool === 'sign' ? 'inherit' : '#10b981'} />
              </button>
              <div className="toolbar-divider" />
              <button className={`tool-btn ${isWatermarkModalOpen ? 'active' : ''}`} onClick={() => setIsWatermarkModalOpen(!isWatermarkModalOpen)} title="Watermark">
                <Stamp size={18} />
              </button>
              <button className={`tool-btn ${isSecurityModalOpen ? 'active' : ''}`} onClick={() => setIsSecurityModalOpen(!isSecurityModalOpen)} title="Security">
                <Lock size={18} />
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
          
          {isWatermarkModalOpen && (
            <div style={{
              position: 'fixed', top: '5rem', right: '2rem', width: '320px', background: 'white',
              borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              padding: '1.5rem', zIndex: 1000, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#171717' }}>Watermark Settings</h3>
                <button onClick={() => setIsWatermarkModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                  <X size={18} color="#64748b" />
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={watermarkConfig.enabled} onChange={e => setWatermarkConfig(p => ({ ...p, enabled: e.target.checked }))} />
                  Enable Watermark
                </label>
              </div>
              
              {watermarkConfig.enabled && (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{ flex: 1, padding: '0.5rem', background: watermarkConfig.mode === 'text' ? '#3b82f6' : '#f8fafc', color: watermarkConfig.mode === 'text' ? 'white' : '#64748b', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setWatermarkConfig(p => ({ ...p, mode: 'text' }))}>Text</button>
                    <button style={{ flex: 1, padding: '0.5rem', background: watermarkConfig.mode === 'image' ? '#3b82f6' : '#f8fafc', color: watermarkConfig.mode === 'image' ? 'white' : '#64748b', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setWatermarkConfig(p => ({ ...p, mode: 'image' }))}>Image</button>
                  </div>
                  
                  {watermarkConfig.mode === 'text' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Text</label>
                      <input type="text" value={watermarkConfig.text} onChange={e => setWatermarkConfig(p => ({ ...p, text: e.target.value }))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Image Upload</label>
                      <input type="file" accept="image/png, image/jpeg" onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const buffer = await file.arrayBuffer();
                          setWatermarkConfig(p => ({ ...p, imageData: buffer, imageType: file.type }));
                        }
                      }} style={{ fontSize: '0.8rem' }} />
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Opacity: {Math.round(watermarkConfig.opacity * 100)}%</label>
                    <input type="range" min="0" max="1" step="0.1" value={watermarkConfig.opacity} onChange={e => setWatermarkConfig(p => ({ ...p, opacity: parseFloat(e.target.value) }))} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Rotation: {watermarkConfig.rotationDeg}°</label>
                    <input type="range" min="0" max="360" step="15" value={watermarkConfig.rotationDeg} onChange={e => setWatermarkConfig(p => ({ ...p, rotationDeg: parseInt(e.target.value) }))} />
                  </div>
                  
                  {watermarkConfig.mode === 'text' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Font Size: {watermarkConfig.fontSize}px</label>
                      <input type="range" min="12" max="120" step="4" value={watermarkConfig.fontSize} onChange={e => setWatermarkConfig(p => ({ ...p, fontSize: parseInt(e.target.value) }))} />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <input type="checkbox" checked={watermarkConfig.tiled} onChange={e => setWatermarkConfig(p => ({ ...p, tiled: e.target.checked }))} />
                      Tiled (Repeat across page)
                    </label>
                    
                    {watermarkConfig.tiled && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Tile Spacing</label>
                        <input type="number" value={watermarkConfig.tileSpacing} onChange={e => setWatermarkConfig(p => ({ ...p, tileSpacing: parseInt(e.target.value) }))} style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Pages to Apply</label>
                    <select value={watermarkConfig.pageRange} onChange={e => setWatermarkConfig(p => ({ ...p, pageRange: e.target.value }))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <option value="all">All Pages</option>
                      <option value="current">Current Page Only</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
          
          {isSecurityModalOpen && (
            <div className="mobile-modal" style={{
              position: 'absolute', top: '5rem', right: '2rem', width: '340px', background: 'white',
              borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              padding: '1.5rem', zIndex: 1000, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem',
              maxHeight: '80vh', overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#171717' }}>Security Settings</h3>
                <button onClick={() => setIsSecurityModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                  <X size={18} color="#64748b" />
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={securityConfig.enabled} onChange={e => setSecurityConfig(p => ({ ...p, enabled: e.target.checked }))} />
                  Enable Password Protection
                </label>
              </div>

              {securityConfig.enabled && (
                <>
                  <div style={{ padding: '0.75rem', background: '#fffbeb', color: '#b45309', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #fde68a' }}>
                    <strong>Warning:</strong> This uses standard AES-256 PDF encryption. While it deters casual users, it is not unbreakable enterprise DRM.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b' }}>User Password (Required to Open)</label>
                    <input type="text" placeholder="Leave empty for none" value={securityConfig.userPassword} onChange={e => setSecurityConfig(p => ({ ...p, userPassword: e.target.value }))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Owner Password (Required to Edit)</label>
                    <input type="text" placeholder="Leave empty for none" value={securityConfig.ownerPassword} onChange={e => setSecurityConfig(p => ({ ...p, ownerPassword: e.target.value }))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                  </div>

                  <h4 style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#171717', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>Permissions</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      Printing Allowed
                      <select value={securityConfig.permissions.printing} onChange={e => setSecurityConfig(p => ({ ...p, permissions: { ...p.permissions, printing: e.target.value } }))} style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        <option value="highResolution">High Resolution</option>
                        <option value="lowResolution">Low Resolution</option>
                        <option value="notAllowed">Not Allowed</option>
                      </select>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
                      <input type="checkbox" checked={securityConfig.permissions.modifying} onChange={e => setSecurityConfig(p => ({ ...p, permissions: { ...p.permissions, modifying: e.target.checked } }))} />
                      Allow Modifying
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
                      <input type="checkbox" checked={securityConfig.permissions.copying} onChange={e => setSecurityConfig(p => ({ ...p, permissions: { ...p.permissions, copying: e.target.checked } }))} />
                      Allow Copying
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
                      <input type="checkbox" checked={securityConfig.permissions.annotating} onChange={e => setSecurityConfig(p => ({ ...p, permissions: { ...p.permissions, annotating: e.target.checked } }))} />
                      Allow Annotating
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
                      <input type="checkbox" checked={securityConfig.permissions.fillingForms} onChange={e => setSecurityConfig(p => ({ ...p, permissions: { ...p.permissions, fillingForms: e.target.checked } }))} />
                      Allow Filling Forms
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          {isUnlockModalOpen && (
            <div className="mobile-modal" style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
              display: 'flex', justifyContent: 'center', alignItems: 'center'
            }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '350px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                  <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '50%' }}>
                    <Lock size={32} color="#d97706" />
                  </div>
                </div>
                <h3 style={{ textAlign: 'center', marginTop: 0, marginBottom: '0.5rem' }}>Protected Document</h3>
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  This PDF is password protected. Please enter the password to view and edit it.
                </p>
                <form onSubmit={e => { e.preventDefault(); }}>
                  <input 
                    type="password" 
                    placeholder="Password" 
                    value={unlockPassword} 
                    onChange={e => setUnlockPassword(e.target.value)} 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box', marginBottom: '1rem' }}
                    autoFocus
                  />
                  <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    Unlock
                  </button>
                </form>
              </div>
            </div>
          )}
          
          <div {...pinchBind()} style={{ touchAction: activeTool === 'select' ? 'pan-x pan-y' : 'none' }}>
            <div className="pdf-page-container" onClick={handleCanvasClick} style={{ 
              cursor: activeTool === 'sign' ? 'crosshair' : 'default',
              margin: '0 auto', 
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              backgroundColor: 'white',
              position: 'relative',
              height: 'fit-content',
              overflow: 'hidden'
            }}>
              <canvas ref={canvasRef} className="pdf-canvas" style={{ display: 'block' }} />
              
              {/* Watermark Preview Layer */}
              {watermarkConfig.enabled && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: watermarkConfig.opacity }}>
                    {(() => {
                      const { mode, text, fontSize, rotationDeg, tiled, tileSpacing } = watermarkConfig;
                      const contentStyle = {
                        transform: `rotate(${rotationDeg}deg)`,
                        transformOrigin: 'center center',
                      };

                      let innerContent = null;
                      if (mode === 'text' && text) {
                        innerContent = <div style={{ ...contentStyle, fontSize: `${fontSize * scale}px`, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', color: 'rgba(0,0,0,1)', whiteSpace: 'nowrap' }}>{text}</div>;
                      } else if (mode === 'image' && watermarkImageUrl) {
                        innerContent = <img src={watermarkImageUrl} style={{ ...contentStyle, maxWidth: `${300 * scale}px`, maxHeight: `${300 * scale}px`, objectFit: 'contain' }} alt="watermark preview" />;
                      }

                      if (!innerContent) return null;

                      if (!tiled) {
                        return (
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                            {innerContent}
                          </div>
                        );
                      } else {
                        const tiles = [];
                        const cols = 5; 
                        const rows = 5;
                        for(let r=0; r<rows; r++) {
                          for(let c=0; c<cols; c++) {
                             tiles.push(
                               <div key={`${r}-${c}`} style={{ position: 'absolute', top: `${r * (tileSpacing + 150)}px`, left: `${c * (tileSpacing + 150)}px` }}>
                                 {innerContent}
                               </div>
                             )
                          }
                        }
                        return <div style={{ position: 'relative', width: '200%', height: '200%', left: '-50%', top: '-50%' }}>{tiles}</div>;
                      }
                    })()}
                  </div>
                </div>
              )}
              
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
              
              {/* Form Fields Layer */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 20 }}>
                {[...existingFormFields.filter(f => f.pageNum === pageNumber), ...(newFormFields[pageNumber] || [])].map((field, i) => {
                   const vRect = getViewportRect(field.pdfX, field.pdfY, field.pdfW, field.pdfH, true);
                   
                   const commonStyle = {
                     position: 'absolute',
                     left: `${vRect.x}px`,
                     top: `${vRect.y}px`,
                     width: `${vRect.width}px`,
                     height: `${vRect.height}px`,
                     pointerEvents: 'auto',
                     backgroundColor: 'rgba(59, 130, 246, 0.1)',
                     border: '1px solid rgba(59, 130, 246, 0.4)',
                     boxSizing: 'border-box',
                     fontFamily: 'sans-serif',
                     fontSize: `${Math.max(12, vRect.height * 0.6)}px`,
                   };

                   if (field.id) {
                     return (
                       <div key={`new-${i}`} style={{ ...commonStyle, display: 'flex', flexDirection: 'column' }}>
                         <div style={{ position: 'absolute', top: '-24px', left: 0, display: 'flex', gap: '4px' }}>
                           <select 
                             value={field.type} 
                             onChange={(e) => {
                               const val = e.target.value;
                               setNewFormFields(prev => ({
                                 ...prev,
                                 [pageNumber]: prev[pageNumber].map(f => f.id === field.id ? { ...f, type: val } : f)
                               }));
                             }}
                             style={{ height: '20px', fontSize: '10px' }}
                           >
                             <option value="Tx">Text</option>
                             <option value="Btn">Checkbox</option>
                           </select>
                           <input 
                             value={field.name}
                             onChange={(e) => {
                               const val = e.target.value;
                               setNewFormFields(prev => ({
                                 ...prev,
                                 [pageNumber]: prev[pageNumber].map(f => f.id === field.id ? { ...f, name: val } : f)
                               }));
                             }}
                             style={{ height: '20px', fontSize: '10px', width: '80px' }}
                             placeholder="Name"
                           />
                         </div>
                         {field.type === 'Tx' && <input type="text" disabled style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }} />}
                         {field.type === 'Btn' && <input type="checkbox" disabled style={{ margin: 'auto' }} />}
                       </div>
                     );
                   }

                   const value = formValues[field.name] !== undefined ? formValues[field.name] : '';
                   const onChange = (e) => {
                     const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                     setFormValues(prev => ({ ...prev, [field.name]: val }));
                   };

                   if (field.type === 'Tx') {
                     return <input key={i} type="text" style={commonStyle} value={value} onChange={onChange} />;
                   }
                   if (field.type === 'Btn' && (field.flags & 65536) === 0) {
                     return <input key={i} type="checkbox" style={{...commonStyle, cursor: 'pointer'}} checked={!!value} onChange={onChange} />;
                   }
                   if (field.type === 'Btn' && (field.flags & 65536) !== 0) {
                     return <input key={i} type="radio" style={{...commonStyle, cursor: 'pointer'}} checked={value === field.name} onChange={onChange} />;
                   }
                   if (field.type === 'Ch') {
                     return (
                       <select key={i} style={commonStyle} value={value} onChange={onChange}>
                         {field.options.map((opt, oIdx) => (
                           <option key={oIdx} value={opt.exportValue}>{opt.displayValue}</option>
                         ))}
                       </select>
                     );
                   }
                   
                   return null;
                })}
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
                className={`drawing-layer ${activeTool === 'draw' || activeTool === 'highlight' || activeTool === 'redact' || activeTool === 'form' ? 'active' : ''}`}
                width={canvasRef.current?.width || 0}
                height={canvasRef.current?.height || 0}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                style={{ touchAction: 'none', position: 'absolute', top: 0, left: 0 }}
              >
                <g transform={`scale(${scale})`}>
                  {(annotations[pageNumber] || []).map((annot, i) => (
                    <path 
                      key={i} 
                      d={generateSvgPath(annot.inkList)} 
                      stroke={annot.color} 
                      strokeWidth={annot.thickness} 
                      fill="none" 
                      strokeOpacity={annot.opacity} 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      style={annot.type === 'highlight' ? { mixBlendMode: 'multiply' } : {}}
                    />
                  ))}
                  {currentAnnotation && currentAnnotation.inkList && (
                    <path 
                      d={generateSvgPath(currentAnnotation.inkList)} 
                      stroke={currentAnnotation.color} 
                      strokeWidth={currentAnnotation.thickness} 
                      fill="none" 
                      strokeOpacity={currentAnnotation.opacity} 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      style={currentAnnotation.type === 'highlight' ? { mixBlendMode: 'multiply' } : {}}
                    />
                  )}
                  
                  {/* Render Completed Redactions */}
                  {(redactions[pageNumber] || []).map((redact, i) => {
                    const vRect = getViewportRect(redact.pdfX, redact.pdfY, redact.pdfW, redact.pdfH);
                    return (
                      <rect 
                        key={`r-${i}`} 
                        x={vRect.x} 
                        y={vRect.y} 
                        width={vRect.width} 
                        height={vRect.height} 
                        fill="rgba(0, 0, 0, 1)" 
                      />
                    );
                  })}

                  {/* Render Current Redaction */}
                  {currentRedaction && (
                    <rect 
                      x={currentRedaction.width < 0 ? currentRedaction.x + currentRedaction.width : currentRedaction.x} 
                      y={currentRedaction.height < 0 ? currentRedaction.y + currentRedaction.height : currentRedaction.y} 
                      width={Math.abs(currentRedaction.width)} 
                      height={Math.abs(currentRedaction.height)} 
                      fill="rgba(239, 68, 68, 0.4)" 
                      stroke="rgba(220, 38, 38, 1)" 
                      strokeWidth="2"
                    />
                  )}

                  {/* Render Current New Form Field */}
                  {currentNewField && (
                    <rect 
                      x={currentNewField.width < 0 ? currentNewField.x + currentNewField.width : currentNewField.x} 
                      y={currentNewField.height < 0 ? currentNewField.y + currentNewField.height : currentNewField.y} 
                      width={Math.abs(currentNewField.width)} 
                      height={Math.abs(currentNewField.height)} 
                      fill="rgba(59, 130, 246, 0.2)" 
                      stroke="rgba(59, 130, 246, 1)" 
                      strokeWidth="2"
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
    </div>
  );
});

export default PdfViewer;
