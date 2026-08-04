import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

# Add Info to lucide-react imports
content = re.sub(r"(import {.*?)(, X)(.*?from 'lucide-react';)", r"\1\2, Info\3", content)

# Add state variables
state_vars = """
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [metadataConfig, setMetadataConfig] = useState({
    title: '', author: '', subject: '', keywords: '', creator: '', producer: ''
  });
"""
content = content.replace("  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false);", state_vars + "  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false);")

# Update loadPdf to extract metadata using pdf-lib
load_logic = """
        const pdfLibDocMeta = await PDFDocument.load(arrayBuffer);
        setMetadataConfig({
          title: pdfLibDocMeta.getTitle() || '',
          author: pdfLibDocMeta.getAuthor() || '',
          subject: pdfLibDocMeta.getSubject() || '',
          keywords: pdfLibDocMeta.getKeywords() ? pdfLibDocMeta.getKeywords().join(', ') : '',
          creator: pdfLibDocMeta.getCreator() || '',
          producer: pdfLibDocMeta.getProducer() || ''
        });
"""
content = content.replace("const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer, password: unlockPassword || undefined }).promise;", load_logic + "        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer, password: unlockPassword || undefined }).promise;")

# Add Metadata Button to Toolbar
toolbar_btn = """
              <button className={`tool-btn ${isMetadataModalOpen ? 'active' : ''}`} onClick={() => setIsMetadataModalOpen(!isMetadataModalOpen)} title="Metadata">
                <Info size={18} />
              </button>
"""
content = content.replace('<button className={`tool-btn ${isWatermarkModalOpen ? \'active\' : \'\'}`} onClick={() => setIsWatermarkModalOpen(!isWatermarkModalOpen)} title="Watermark">', toolbar_btn + '              <button className={`tool-btn ${isWatermarkModalOpen ? \'active\' : \'\'}`} onClick={() => setIsWatermarkModalOpen(!isWatermarkModalOpen)} title="Watermark">')

# Add Metadata Modal UI
modal_ui = """
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
"""
content = content.replace("{isWatermarkModalOpen && (", modal_ui + "\n          {isWatermarkModalOpen && (")

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
