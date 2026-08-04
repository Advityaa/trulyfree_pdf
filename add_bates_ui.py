import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

modal_ui = """
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
"""
content = content.replace("{isMetadataModalOpen && (", modal_ui + "\n          {isMetadataModalOpen && (")

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
