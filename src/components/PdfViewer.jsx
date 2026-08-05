import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import pptxgen from 'pptxgenjs';
import { PDFDocument, rgb, StandardFonts, degrees, radians, PDFString, PDFName } from 'pdf-lib';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { FileOutput, RotateCw, ZoomIn, ZoomOut, MousePointer2, Type, Pen, Highlighter, Shield, CheckSquare, Stamp, Lock, X, Info, Hash, Bookmark, BookmarkPlus, ChevronRight as IconChevronRight, ChevronDown } from 'lucide-react';
import SidebarThumbnail from './SidebarThumbnail';
import { usePinch } from '@use-gesture/react';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, Trash, FilePlus2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';


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
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageOrder, setPageOrder] = useState([]);



  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isPkiModalOpen, setIsPkiModalOpen] = useState(false);
  const [pkiConfig, setPkiConfig] = useState({ enabled: false, certFile: null, password: '' });
  const [activeSidebarTab, setActiveSidebarTab] = useState('thumbnails'); // 'thumbnails' | 'bookmarks'
  const [bookmarks, setBookmarks] = useState([]);

  const activePage = pageOrder[pageNumber - 1] || null;
  const activePageId = activePage ? activePage.id : null;
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef(null);

  const [textLines, setTextLines] = useState([]);
  const [isEnhancingOCR, setIsEnhancingOCR] = useState(false);

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



  const [isBatesModalOpen, setIsBatesModalOpen] = useState(false);
  const [batesConfig, setBatesConfig] = useState({
    enabled: false,
    prefix: 'ABC',
    startNumber: 1,
    digitPadding: 6,
    suffix: '',
    position: 'bottom-right',
    fontSize: 12,
    fontColor: '#000000',
    pageRange: 'all'
  });

  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [metadataConfig, setMetadataConfig] = useState({
    title: '', author: '', subject: '', keywords: '', creator: '', producer: ''
  });
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
        
        const pdfjsDoc = await pdfjsLib.getDocument({ 
          data: arrayBuffer, 
          password: unlockPassword || undefined,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@6.1.200/cmaps/',
          cMapPacked: true
        }).promise;
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
      try {
        const originalBytes = file ? await file.arrayBuffer() : encryptedFileBytes;
        const originalDoc = await PDFDocument.load(originalBytes);
        
        const pdfLibDoc = await PDFDocument.create();
        
        const requiredOriginalIndices = pageOrder.filter(p => !p.isBlank).map(p => p.originalIndex);
        const copiedPages = requiredOriginalIndices.length > 0 
           ? await pdfLibDoc.copyPages(originalDoc, requiredOriginalIndices) 
           : [];
           
        let copyIdx = 0;
        for (const p of pageOrder) {
           let newPage;
           if (p.isBlank) {
              newPage = pdfLibDoc.addPage([595.28, 841.89]);
           } else {
              newPage = copiedPages[copyIdx++];
              pdfLibDoc.addPage(newPage);
           }
           if (p.rotation) {
              newPage.setRotation(degrees(newPage.getRotation().angle + p.rotation));
           }
        }
        
        const pages = pdfLibDoc.getPages();

        for (let i = 0; i < pageOrder.length; i++) {
          const p = pageOrder[i];
          const page = pages[i];
          const pId = p.id;

          // Text Edits
          const pageEdits = edits[pId];
          if (pageEdits) {
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

          // Annotations
          const pageAnnots = annotations[pId];
          if (pageAnnots) {
            for (const annot of pageAnnots) {
              if (annot.type === 'ink' || annot.type === 'highlight') {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                const inkList = annot.inkList.map(pts => {
                   const arr = [];
                   for(let j=0; j<pts.length; j+=2) {
                      minX = Math.min(minX, pts[j]);
                      minY = Math.min(minY, pts[j+1]);
                      maxX = Math.max(maxX, pts[j]);
                      maxY = Math.max(maxY, pts[j+1]);
                      arr.push(pdfLibDoc.context.obj(pts[j]), pdfLibDoc.context.obj(pts[j+1]));
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

          // Signatures
          const pageSigs = signatures[pId];
          if (pageSigs) {
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


          // Form Fields
          const pageFields = newFormFields[pId];
          if (pageFields && pageFields.length > 0) {
            const form = pdfLibDoc.getForm() || pdfLibDoc.catalog.getOrCreateForm();
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

          // Redactions
          const pageRedacts = redactions[pId];
          if (pageRedacts) {
            for (const redact of pageRedacts) {
               page.drawRectangle({
                  x: redact.pdfX,
                  y: redact.pdfY,
                  width: redact.pdfW,
                  height: redact.pdfH,
                  color: rgb(0,0,0)
               });
            }
          }
        }
        
        // Watermark
        if (watermarkConfig.enabled) {
          let embeddedWatermarkImg = null;
          if (watermarkConfig.mode === 'image' && watermarkConfig.imageData) {
            if (watermarkConfig.imageType === 'image/png') {
              embeddedWatermarkImg = await pdfLibDoc.embedPng(watermarkConfig.imageData);
            } else {
              embeddedWatermarkImg = await pdfLibDoc.embedJpg(watermarkConfig.imageData);
            }
          }

          for (let i = 0; i < pageOrder.length; i++) {
            const pId = pageOrder[i].id;
            const page = pages[i];
            
            if (watermarkConfig.pageRange === 'current' && pId !== activePageId) {
              continue; // Skip
            }

            const { width, height } = page.getSize();
            const { mode, text, fontSize, rotationDeg, opacity, tiled, tileSpacing } = watermarkConfig;
            
            const drawContent = (x, y) => {
              if (mode === 'text' && text) {
                 page.drawText(text, { x, y, size: fontSize, opacity, rotate: degrees(rotationDeg), color: rgb(0,0,0) });
              } else if (mode === 'image' && embeddedWatermarkImg) {
                 const imgDims = embeddedWatermarkImg.scale(0.5);
                 page.drawImage(embeddedWatermarkImg, { x, y, width: imgDims.width, height: imgDims.height, opacity, rotate: degrees(rotationDeg) });
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
          }
        }

        
        
        
        // Bookmarks / Outlines Generation
        if (bookmarks && bookmarks.length > 0) {
           const buildTree = (flatList) => {
              const root = { children: [] };
              const path = [root];
              
              for (const bm of flatList) {
                 const node = { ...bm, children: [] };
                 const depth = Math.min(bm.depth || 0, path.length - 1);
                 
                 const parent = path[depth];
                 parent.children.push(node);
                 
                 path[depth + 1] = node;
                 path.length = depth + 2;
              }
              return root.children;
           };
           
           const tree = buildTree(bookmarks);
           
           const outlinesDict = pdfLibDoc.context.obj({ Type: 'Outlines' });
           const outlinesRef = pdfLibDoc.context.register(outlinesDict);
           
           const buildOutlineNodes = (nodes, parentRef) => {
              const refs = nodes.map(n => pdfLibDoc.context.nextRef());
              
              for (let i = 0; i < nodes.length; i++) {
                  const node = nodes[i];
                  const ref = refs[i];
                  
                  let destArray = null;
                  if (node.targetPageId) {
                     const pIdx = pageOrder.findIndex(p => p.id === node.targetPageId);
                     if (pIdx !== -1) {
                        const targetPage = pages[pIdx];
                        destArray = pdfLibDoc.context.obj([targetPage.ref, PDFName.of('XYZ'), null, null, null]);
                     }
                  }
                  
                  const dict = {
                     Title: PDFString.of(node.title || 'Untitled'),
                     Parent: parentRef
                  };
                  if (destArray) dict.Dest = destArray;
                  if (i > 0) dict.Prev = refs[i - 1];
                  if (i < nodes.length - 1) dict.Next = refs[i + 1];
                  
                  if (node.children && node.children.length > 0) {
                     const childRefs = buildOutlineNodes(node.children, ref);
                     dict.First = childRefs[0];
                     dict.Last = childRefs[childRefs.length - 1];
                     dict.Count = node.children.length; 
                  }
                  
                  pdfLibDoc.context.assign(ref, pdfLibDoc.context.obj(dict));
              }
              return refs;
           };
           
           const topLevelRefs = buildOutlineNodes(tree, outlinesRef);
           if (topLevelRefs.length > 0) {
              outlinesDict.set(PDFName.of('First'), topLevelRefs[0]);
              outlinesDict.set(PDFName.of('Last'), topLevelRefs[topLevelRefs.length - 1]);
              pdfLibDoc.catalog.set(PDFName.of('Outlines'), outlinesRef);
           }
        }

        // Bates Numbering
        if (batesConfig.enabled) {
          const batesFont = await pdfLibDoc.embedFont(StandardFonts.Helvetica);
          const { prefix, suffix, startNumber, digitPadding, position, fontSize, fontColor, pageRange } = batesConfig;
          const rgbColor = hexToRgb(fontColor);

          let batesIndex = 0;
          for (let i = 0; i < pageOrder.length; i++) {
            const pId = pageOrder[i].id;
            const page = pages[i];
            
            if (pageRange === 'current' && pId !== activePageId) {
              continue;
            }

            const formattedNumber = prefix + String(startNumber + batesIndex).padStart(digitPadding, '0') + suffix;
            const textWidth = batesFont.widthOfTextAtSize(formattedNumber, fontSize);
            const textHeight = batesFont.heightAtSize(fontSize);
            
            const { width, height } = page.getSize();
            let x, y;
            const margin = 30;

            if (position.includes('left')) x = margin;
            else if (position.includes('right')) x = width - textWidth - margin;
            else x = (width - textWidth) / 2;

            if (position.includes('top')) y = height - textHeight - margin;
            else y = margin; // bottom

            page.drawText(formattedNumber, {
              x, y,
              size: fontSize,
              font: batesFont,
              color: rgb(rgbColor.red, rgbColor.green, rgbColor.blue)
            });

            batesIndex++;
          }
        }

        // Apply Metadata
        if (metadataConfig.title) pdfLibDoc.setTitle(metadataConfig.title);
        if (metadataConfig.author) pdfLibDoc.setAuthor(metadataConfig.author);
        if (metadataConfig.subject) pdfLibDoc.setSubject(metadataConfig.subject);
        if (metadataConfig.keywords) pdfLibDoc.setKeywords(metadataConfig.keywords.split(',').map(k => k.trim()));
        if (metadataConfig.creator) pdfLibDoc.setCreator(metadataConfig.creator);
        if (metadataConfig.producer) pdfLibDoc.setProducer(metadataConfig.producer);
        
        pdfLibDoc.setModificationDate(new Date());

        // Apply Encryption
        if (securityConfig.isEncrypted) {
           pdfLibDoc.encrypt({
              userPassword: securityConfig.userPassword || undefined,
              ownerPassword: securityConfig.ownerPassword || undefined,
              permissions: {
                printing: securityConfig.permissions.printing === 'highRes' ? 'highResolution' : (securityConfig.permissions.printing === 'lowRes' ? 'lowResolution' : undefined),
                modifying: securityConfig.permissions.modifying,
                copying: securityConfig.permissions.copying,
                annotating: securityConfig.permissions.annotating,
                fillingForms: securityConfig.permissions.fillingForms,
                documentAssembly: securityConfig.permissions.modifying
              }
           });
        }

        return await pdfLibDoc.save();
      } catch (err) {
        console.error("[PdfViewer] Export error:", err);
        throw err;
      }
    }
  }));


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPageOrder((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        const currentActiveId = items[pageNumber - 1]?.id;
        const newActiveIndex = newOrder.findIndex(i => i.id === currentActiveId);
        if (newActiveIndex !== -1) {
           setPageNumber(newActiveIndex + 1);
        }
        return newOrder;
      });
    }
  };

  const handleRotatePage = (id) => {
    setPageOrder(items => items.map(p => p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p));
  };

  const handleDuplicatePage = (id) => {
    setPageOrder(items => {
      const idx = items.findIndex(i => i.id === id);
      const pageToDup = items[idx];
      const newPage = { ...pageToDup, id: `page-${pageToDup.originalIndex}-${Date.now()}` };
      const newOrder = [...items];
      newOrder.splice(idx + 1, 0, newPage);
      return newOrder;
    });
  };

  const handleDeletePage = (id) => {
    setPageOrder(items => items.filter(p => p.id !== id));
  };

  const handleInsertBlankPage = () => {
    setPageOrder(items => {
      const newPage = { id: `blank-${Date.now()}`, isBlank: true, rotation: 0 };
      const newOrder = [...items];
      newOrder.splice(pageNumber, 0, newPage);
      return newOrder;
    });
    setPageNumber(pageNumber + 1);
  };

  useEffect(() => {
    const loadPdf = async () => {
      if (!file) return;
      try {
        const arrayBuffer = encryptedFileBytes || await file.arrayBuffer();
        if (!encryptedFileBytes) setEncryptedFileBytes(arrayBuffer);

        
        const pdfLibDocMeta = await PDFDocument.load(arrayBuffer);
        setMetadataConfig({
          title: pdfLibDocMeta.getTitle() || '',
          author: pdfLibDocMeta.getAuthor() || '',
          subject: pdfLibDocMeta.getSubject() || '',
          keywords: pdfLibDocMeta.getKeywords() ? pdfLibDocMeta.getKeywords().join(', ') : '',
          creator: pdfLibDocMeta.getCreator() || '',
          producer: pdfLibDocMeta.getProducer() || ''
        });
        const pdfDoc = await pdfjsLib.getDocument({ 
          data: arrayBuffer, 
          password: unlockPassword || undefined,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@6.1.200/cmaps/',
          cMapPacked: true
        }).promise;
        setPdfDoc(pdfDoc);
        setNumPages(pdfDoc.numPages);
        
        const initialOrder = Array.from({ length: pdfDoc.numPages }, (_, i) => ({
          id: `page-${i + 1}-${Date.now()}`,
          originalIndex: i,
          rotation: 0,
          isBlank: false
        }));
        setPageOrder(initialOrder);

        const outline = await pdfDoc.getOutline();
        const flattenOutline = async (items, depth = 0, flattened = []) => {
          if (!items) return flattened;
          for (const item of items) {
             let destPageId = null;
             try {
                let dest = item.dest;
                if (typeof dest === 'string') {
                   dest = await pdfDoc.getDestination(dest);
                }
                if (dest && dest[0]) {
                   const pageIndex = await pdfDoc.getPageIndex(dest[0]);
                   destPageId = initialOrder[pageIndex]?.id || null;
                }
             } catch (e) {
                console.warn("Could not resolve outline destination", e);
             }
             
             flattened.push({
                id: `bm-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                title: item.title,
                targetPageId: destPageId,
                depth: depth
             });
             
             if (item.items && item.items.length > 0) {
                await flattenOutline(item.items, depth + 1, flattened);
             }
          }
          return flattened;
        };
        const initialBookmarks = await flattenOutline(outline);
        setBookmarks(initialBookmarks);

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
    if (!pdfDoc || !canvasRef.current || !activePage) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    
    if (activePage.isBlank) {
       const canvas = canvasRef.current;
       const context = canvas.getContext('2d');
       const dpr = window.devicePixelRatio || 1;
       const rawWidth = 595.28 * scale;
       const rawHeight = 841.89 * scale;
       canvas.width = rawWidth * dpr;
       canvas.height = rawHeight * dpr;
       canvas.style.width = `${rawWidth}px`;
       canvas.style.height = `${rawHeight}px`;
       
       const viewport = { width: rawWidth, height: rawHeight, transform: [scale,0,0,scale,0,0] };
       setCurrentViewport(viewport);
       
       context.fillStyle = 'white';
       context.fillRect(0,0,canvas.width,canvas.height);
       setTextLines([]);
       return;
    }

    try {
      const page = await pdfDoc.getPage(activePage.originalIndex + 1);
      const viewport = page.getViewport({ scale, rotation: page.rotate + rotation + activePage.rotation });
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
        // A space is typically 20-30% of font height. Allow up to ~50% of height, minimum 8px.
        const maxGap = Math.max(frag.height * 0.5, 8);
        const isCloseX = distanceX < maxGap;

        if (isSameLine && isCloseX) {
          if (distanceX > (frag.height * 0.15) && !prevFrag.str.endsWith(' ') && !frag.str.startsWith(' ')) {
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
  }, [pdfDoc, activePage, scale, rotation]);

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
      const pageSigs = prev[activePageId] || [];
      return {
        ...prev,
        [activePageId]: [
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
          [activePageId]: [...(prev[activePageId] || []), { pdfX, pdfY, pdfW, pdfH }]
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
          [activePageId]: [...(prev[activePageId] || []), { id, name: id, type: 'Tx', pdfX, pdfY, pdfW, pdfH }]
        }));
      }
      setCurrentNewField(null);
      e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }

    if (!currentAnnotation) return;
    setAnnotations(prev => {
      const pageAnnots = prev[activePageId] || [];
      return {
        ...prev,
        [activePageId]: [...pageAnnots, currentAnnotation]
      };
    });
    setCurrentAnnotation(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };


  const handleEnhanceOCR = async () => {
    try {
      setIsEnhancingOCR(true);
      const page = await pdfDoc.getPage(activePage.originalIndex + 1);
      const viewport = page.getViewport({ scale: 2.0, rotation: 0 }); 
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 1.0));
      const formData = new FormData();
      formData.append('file', blob, 'page.jpg');
      
      const res = await fetch('http://localhost:8000/api/ocr/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      const ocrLines = data.blocks.map(block => {
         const unscaledW = block.width / 2.0;
         const unscaledH = block.height / 2.0;
         const unscaledX = block.x / 2.0;
         const unscaledY = block.y / 2.0; 
         
         const pdfY = (viewport.height / 2.0) - unscaledY - unscaledH;
         
         const baseTransform = [unscaledH, 0, 0, unscaledH, unscaledX, pdfY];
         const scaledTransform = pdfjsLib.Util.transform(currentViewport.transform, baseTransform);
         
         return {
            originalStr: block.text,
            isOcr: true,
            unscaledTransform: baseTransform,
            transform: scaledTransform,
            width: unscaledW * scale,
            unscaledWidth: unscaledW,
            fontName: 'OCR-Font'
         };
      });
      
      // Merge with existing textLines, avoiding duplicates
      setTextLines(prev => {
         const newLines = ocrLines.filter(ocrLine => {
            const cx = ocrLine.unscaledTransform[4] + ocrLine.unscaledWidth / 2;
            const cy = ocrLine.unscaledTransform[5] + ocrLine.unscaledTransform[3] / 2;
            return !prev.some(line => {
               const lx = line.unscaledTransform[4];
               const ly = line.unscaledTransform[5];
               const lw = line.unscaledWidth;
               const lh = line.unscaledTransform[3]; 
               return cx >= lx - 5 && cx <= lx + lw + 5 && cy >= ly - 5 && cy <= ly + lh + 5;
            });
         });
         return [...prev, ...newLines];
      });
    } catch(err) {
      alert("OCR failed: " + err.message);
    } finally {
      setIsEnhancingOCR(false);
    }
  };

  const handleTextClick = (index) => {
    if (activeTool === 'text') {
      setEditingId(index);
    }
  };

  const handleTextChange = (index, newValue) => {
    setEdits(prev => {
      const pageEdits = prev[activePageId] || {};
      return {
        ...prev,
        [activePageId]: {
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
              {activeTool === 'text' && (
                <button 
                  className="tool-btn" 
                  onClick={handleEnhanceOCR} 
                  disabled={isEnhancingOCR}
                  title="Enhance with OCR (Detect images as text)"
                  style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.8rem', padding: '0 8px', width: 'auto', fontWeight: '600' }}
                >
                  {isEnhancingOCR ? 'Scanning...' : 'Enhance with OCR'}
                </button>
              )}
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
              
              
              <button className={`tool-btn ${isBatesModalOpen ? 'active' : ''}`} onClick={() => setIsBatesModalOpen(!isBatesModalOpen)} title="Bates Numbering">
                <Hash size={18} />
              </button>
              
              <button className={`tool-btn ${isPkiModalOpen ? 'active' : ''}`} onClick={() => setIsPkiModalOpen(!isPkiModalOpen)} title="Digital Signature (PKI)">
                <Shield size={18} />
              </button>
<button className={`tool-btn ${isMetadataModalOpen ? 'active' : ''}`} onClick={() => setIsMetadataModalOpen(!isMetadataModalOpen)} title="Metadata">
                <Info size={18} />
              </button>
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
          
          
          
          
          {isPkiModalOpen && (
            <div className="mobile-modal" style={{ position: 'absolute', top: '5rem', left: '2rem', width: '380px', background: 'white', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '1.5rem', zIndex: 1000, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#171717' }}>Cryptographic Digital Signature</h3>
                <button onClick={() => setIsPkiModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                  <X size={18} color="#64748b" />
                </button>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Unlike visual stamps, a PKI Digital Signature mathematically binds your identity to the file and makes it tamper-evident.</p>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                <input type="checkbox" checked={pkiConfig.enabled} onChange={e => setPkiConfig(p => ({ ...p, enabled: e.target.checked }))} />
                Enable Digital Signing on Export
              </label>

              {pkiConfig.enabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Certificate (.p12 / .pfx)</label>
                    <input type="file" accept=".p12,.pfx" onChange={e => setPkiConfig(p => ({ ...p, certFile: e.target.files[0] }))} style={{ fontSize: '0.85rem' }} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Certificate Password</label>
                    <input type="password" value={pkiConfig.password} onChange={e => setPkiConfig(p => ({ ...p, password: e.target.value }))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                  </div>

                  {!pkiConfig.certFile && (
                    <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>Don't have a certificate?</p>
                      <button 
                        onClick={async () => {
                           try {
                             const res = await fetch('http://localhost:8001/api/generate-cert', { method: 'POST' });
                             const blob = await res.blob();
                             const url = URL.createObjectURL(blob);
                             const a = document.createElement('a');
                             a.href = url;
                             a.download = 'self_signed_cert.p12';
                             a.click();
                             alert("Downloaded self_signed_cert.p12! Password is 'password'. Upload it above to sign.");
                           } catch (err) {
                             alert("Error generating cert: " + err.message);
                           }
                        }}
                        style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
                      >
                        Generate Self-Signed Cert
                      </button>
                      <p style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '0.5rem' }}>Note: Self-signed certs appear "Unverified" in Acrobat unless manually trusted by the recipient.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isBatesModalOpen && (
            <div className="mobile-modal" style={{
              position: 'absolute', top: '5rem', right: '2rem', width: '320px', background: 'white',
              borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              padding: '1.5rem', zIndex: 1000, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem',
              maxHeight: '80vh', overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#171717' }}>Sequential Numbering</h3>
                <button onClick={() => setIsBatesModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                  <X size={18} color="#64748b" />
                </button>
              </div>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={batesConfig.enabled} onChange={e => setBatesConfig(p => ({ ...p, enabled: e.target.checked }))} />
                Enable Numbering
              </label>

              {batesConfig.enabled && (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Prefix</label>
                      <input type="text" value={batesConfig.prefix} onChange={e => setBatesConfig(p => ({ ...p, prefix: e.target.value }))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Suffix</label>
                      <input type="text" value={batesConfig.suffix} onChange={e => setBatesConfig(p => ({ ...p, suffix: e.target.value }))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Start Number</label>
                      <input type="number" min="1" value={batesConfig.startNumber} onChange={e => setBatesConfig(p => ({ ...p, startNumber: parseInt(e.target.value)||1 }))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Padding</label>
                      <input type="number" min="1" max="10" value={batesConfig.digitPadding} onChange={e => setBatesConfig(p => ({ ...p, digitPadding: parseInt(e.target.value)||1 }))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Position</label>
                    <select value={batesConfig.position} onChange={e => setBatesConfig(p => ({ ...p, position: e.target.value }))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="bottom-center">Bottom Center</option>
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                      <option value="top-center">Top Center</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Font Size: {batesConfig.fontSize}px</label>
                      <input type="range" min="8" max="48" step="1" value={batesConfig.fontSize} onChange={e => setBatesConfig(p => ({ ...p, fontSize: parseInt(e.target.value) }))} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Color</label>
                      <input type="color" value={batesConfig.fontColor} onChange={e => setBatesConfig(p => ({ ...p, fontColor: e.target.value }))} style={{ width: '100%', height: '32px' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Pages to Apply</label>
                    <select value={batesConfig.pageRange} onChange={e => setBatesConfig(p => ({ ...p, pageRange: e.target.value }))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <option value="all">All Pages</option>
                      <option value="current">Current Page Only</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {isMetadataModalOpen && (
            <div className="mobile-modal" style={{
              position: 'absolute', top: '5rem', right: '2rem', width: '320px', background: 'white',
              borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              padding: '1.5rem', zIndex: 1000, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem',
              maxHeight: '80vh', overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#171717' }}>Document Metadata</h3>
                <button onClick={() => setIsMetadataModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
                  <X size={18} color="#64748b" />
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {['title', 'author', 'subject', 'keywords', 'creator', 'producer'].map(field => (
                  <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'capitalize' }}>{field}</label>
                    <input 
                      type="text" 
                      value={metadataConfig[field]} 
                      onChange={e => setMetadataConfig(p => ({ ...p, [field]: e.target.value }))} 
                      style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }} 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

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
                {(signatures[activePageId] || []).map((sig, i) => (
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
                {[...existingFormFields.filter(f => f.pageNum === (activePage ? activePage.originalIndex + 1 : 1)), ...(newFormFields[activePageId] || [])].map((field, i) => {
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
                                 [pageNumber]: prev[activePageId].map(f => f.id === field.id ? { ...f, type: val } : f)
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
                                 [pageNumber]: prev[activePageId].map(f => f.id === field.id ? { ...f, name: val } : f)
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
                  {(annotations[activePageId] || []).map((annot, i) => (
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
                  {(redactions[activePageId] || []).map((redact, i) => {
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
                  const pageEdits = edits[activePageId] || {};
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

    </div>
  );
});

export default PdfViewer;
