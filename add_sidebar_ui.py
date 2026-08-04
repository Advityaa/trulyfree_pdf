import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

# Add import
content = content.replace("import { usePinch }", "import SidebarThumbnail from './SidebarThumbnail';\nimport { usePinch }")

sidebar_ui = """
    <div style={{ display: 'flex', flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
      
      <aside className="pdf-sidebar">
        <div className="sidebar-header">
          <span>Thumbnails</span>
          <button onClick={handleInsertBlankPage} className="thumb-btn" title="Add Blank Page" style={{ padding: '4px' }}>
            <FilePlus2 size={16} />
          </button>
        </div>
        <div className="thumbnails-list">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pageOrder.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {pageOrder.map((page, index) => (
                <SidebarThumbnail 
                  key={page.id}
                  id={page.id}
                  page={page}
                  index={index}
                  isActive={pageNumber === index + 1}
                  pdfDoc={pdfDoc}
                  onSelect={setPageNumber}
                  onRotate={handleRotatePage}
                  onDuplicate={handleDuplicatePage}
                  onDelete={handleDeletePage}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </aside>

      <div className="pdf-workspace" style={{ flex: 1, position: 'relative', background: '#f8fafc', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
"""

# Replace the start of the workspace div
content = content.replace('    <>\n      <div className="pdf-workspace" style={{ flex: 1, position: \'relative\', background: \'#f8fafc\', overflow: \'hidden\', display: \'flex\', flexDirection: \'column\' }}>', sidebar_ui)
content = content.replace('      </div>\n    </>', '      </div>\n    </div>')

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
