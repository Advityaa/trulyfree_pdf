import React, { useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RotateCw, Copy, Trash } from 'lucide-react';

export default function SidebarThumbnail({ id, page, index, isActive, pdfDoc, onSelect, onRotate, onDuplicate, onDelete }) {
  const canvasRef = useRef(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : 'auto',
    position: 'relative'
  };

  useEffect(() => {
    let renderTask = null;
    const renderThumb = async () => {
      if (!canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (page.isBlank) {
        canvas.width = 595.28 * 0.15;
        canvas.height = 841.89 * 0.15;
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }

      if (!pdfDoc) return;

      try {
        const pdfPage = await pdfDoc.getPage(page.originalIndex + 1);
        const viewport = pdfPage.getViewport({ scale: 0.15, rotation: pdfPage.rotate + page.rotation });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = { canvasContext: context, viewport };
        renderTask = pdfPage.render(renderContext);
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
  }, [pdfDoc, page.originalIndex, page.rotation, page.isBlank]);

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`thumbnail-container ${isActive ? 'active' : ''}`}
    >
      <div 
        className="thumbnail-canvas-wrapper"
        onClick={() => onSelect(index + 1)}
        {...attributes} 
        {...listeners}
      >
        <span className="thumbnail-number">{index + 1}</span>
        <canvas ref={canvasRef} className="thumbnail-canvas" />
      </div>
      
      <div className="thumbnail-actions">
        <button className="thumb-btn" onClick={(e) => { e.stopPropagation(); onRotate(id); }} title="Rotate 90°">
          <RotateCw size={14} />
        </button>
        <button className="thumb-btn" onClick={(e) => { e.stopPropagation(); onDuplicate(id); }} title="Duplicate">
          <Copy size={14} />
        </button>
        <button className="thumb-btn text-red-500" onClick={(e) => { e.stopPropagation(); onDelete(id); }} title="Delete">
          <Trash size={14} color="#ef4444" />
        </button>
      </div>
    </div>
  );
}
