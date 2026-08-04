import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

# Define the start and end of the aside block
start_tag = '<aside className="pdf-sidebar">'
end_tag = '</aside>'

start_idx = content.find(start_tag)
end_idx = content.find(end_tag, start_idx) + len(end_tag)

new_aside = """<aside className="pdf-sidebar">
        <div className="sidebar-header" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', width: '100%', borderBottom: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setActiveSidebarTab('thumbnails')}
              style={{ flex: 1, padding: '0.75rem', border: 'none', background: activeSidebarTab === 'thumbnails' ? 'white' : '#f8fafc', color: activeSidebarTab === 'thumbnails' ? '#3b82f6' : '#64748b', fontWeight: activeSidebarTab === 'thumbnails' ? 600 : 500, cursor: 'pointer', borderBottom: activeSidebarTab === 'thumbnails' ? '2px solid #3b82f6' : '2px solid transparent' }}
            >
              Thumbnails
            </button>
            <button 
              onClick={() => setActiveSidebarTab('bookmarks')}
              style={{ flex: 1, padding: '0.75rem', border: 'none', background: activeSidebarTab === 'bookmarks' ? 'white' : '#f8fafc', color: activeSidebarTab === 'bookmarks' ? '#3b82f6' : '#64748b', fontWeight: activeSidebarTab === 'bookmarks' ? 600 : 500, cursor: 'pointer', borderBottom: activeSidebarTab === 'bookmarks' ? '2px solid #3b82f6' : '2px solid transparent' }}
            >
              Bookmarks
            </button>
          </div>
          
          {activeSidebarTab === 'thumbnails' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.5rem 1rem' }}>
               <button onClick={handleInsertBlankPage} className="thumb-btn" title="Add Blank Page" style={{ padding: '4px' }}>
                 <FilePlus2 size={16} />
               </button>
            </div>
          )}
          {activeSidebarTab === 'bookmarks' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.5rem 1rem' }}>
               <button onClick={() => setBookmarks([...bookmarks, { id: `bm-${Date.now()}`, title: 'New Bookmark', targetPageId: activePageId, depth: 0 }])} className="thumb-btn" title="Add Bookmark" style={{ padding: '4px' }}>
                 <BookmarkPlus size={16} />
               </button>
            </div>
          )}
        </div>

        <div className="thumbnails-list" style={{ padding: activeSidebarTab === 'bookmarks' ? '0.5rem' : '1rem' }}>
          {activeSidebarTab === 'thumbnails' && (
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
          )}

          {activeSidebarTab === 'bookmarks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {bookmarks.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>No bookmarks found.</p>}
              {bookmarks.map((bm, index) => {
                const pIdx = pageOrder.findIndex(p => p.id === bm.targetPageId);
                return (
                <div key={bm.id} style={{ display: 'flex', flexDirection: 'column', marginLeft: `${bm.depth * 16}px`, background: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.5rem', gap: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      value={bm.title} 
                      onChange={e => setBookmarks(bms => bms.map(b => b.id === bm.id ? { ...b, title: e.target.value } : b))}
                      style={{ border: 'none', background: 'transparent', flex: 1, fontSize: '0.9rem', color: '#171717', outline: 'none', fontWeight: 500 }}
                    />
                    <button onClick={() => setBookmarks(bms => bms.filter(b => b.id !== bm.id))} className="thumb-btn text-red-500" style={{ padding: '2px' }}><Trash size={14} color="#ef4444" /></button>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {pIdx !== -1 ? `Page ${pIdx + 1}` : 'No destination'}
                    </span>
                    
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={() => setBookmarks(bms => bms.map(b => b.id === bm.id ? { ...b, targetPageId: activePageId } : b))} className="thumb-btn" style={{ fontSize: '0.7rem', padding: '2px 4px' }} title="Set dest to current page">Set Dest</button>
                      
                      <button onClick={() => {
                         if (index > 0) {
                            const newBms = [...bookmarks];
                            [newBms[index - 1], newBms[index]] = [newBms[index], newBms[index - 1]];
                            setBookmarks(newBms);
                         }
                      }} className="thumb-btn" style={{ padding: '2px' }} title="Move Up">↑</button>
                      <button onClick={() => {
                         if (index < bookmarks.length - 1) {
                            const newBms = [...bookmarks];
                            [newBms[index], newBms[index + 1]] = [newBms[index + 1], newBms[index]];
                            setBookmarks(newBms);
                         }
                      }} className="thumb-btn" style={{ padding: '2px' }} title="Move Down">↓</button>
                      <button onClick={() => setBookmarks(bms => bms.map(b => b.id === bm.id ? { ...b, depth: Math.max(0, b.depth - 1) } : b))} className="thumb-btn" style={{ padding: '2px' }} title="Outdent">←</button>
                      <button onClick={() => setBookmarks(bms => bms.map(b => b.id === bm.id ? { ...b, depth: b.depth + 1 } : b))} className="thumb-btn" style={{ padding: '2px' }} title="Indent">→</button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      </aside>"""

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_aside + content[end_idx:]

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
