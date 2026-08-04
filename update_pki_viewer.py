import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

# Add imports
content = content.replace("import * as pdfjsLib from 'pdfjs-dist';", "import * as pdfjsLib from 'pdfjs-dist';\nimport { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';")

# Add state
state_vars = """
  const [isPkiModalOpen, setIsPkiModalOpen] = useState(false);
  const [pkiConfig, setPkiConfig] = useState({ enabled: false, certFile: null, password: '' });
"""
content = content.replace("  const [activeSidebarTab, setActiveSidebarTab] = useState('thumbnails');", state_vars + "  const [activeSidebarTab, setActiveSidebarTab] = useState('thumbnails');")

# Add button to toolbar (next to Redact Shield)
btn = """
              <button className={`tool-btn ${isPkiModalOpen ? 'active' : ''}`} onClick={() => setIsPkiModalOpen(!isPkiModalOpen)} title="Digital Signature (PKI)">
                <Shield size={18} />
              </button>
"""
content = content.replace('<button className={`tool-btn ${isMetadataModalOpen ? \'active\' : \'\'}`} onClick={() => setIsMetadataModalOpen(!isMetadataModalOpen)} title="Metadata">', btn + '<button className={`tool-btn ${isMetadataModalOpen ? \'active\' : \'\'}`} onClick={() => setIsMetadataModalOpen(!isMetadataModalOpen)} title="Metadata">')


# Add the PKI Modal
pki_modal = """
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
"""
content = content.replace("{isBatesModalOpen && (", pki_modal + "\n          {isBatesModalOpen && (")


# Export Logic
pki_export = """
        if (pkiConfig.enabled && pkiConfig.certFile) {
           pdflibAddPlaceholder({
              pdfDoc: pdfLibDoc,
              reason: 'Digitally Signed via TrulyFree PDF',
              signatureLength: 8192
           });
        }
        
        let pdfBytes = await pdfLibDoc.save();
        
        if (pkiConfig.enabled && pkiConfig.certFile) {
           const formData = new FormData();
           formData.append('pdf', new Blob([pdfBytes], { type: 'application/pdf' }));
           formData.append('cert', pkiConfig.certFile);
           formData.append('password', pkiConfig.password);
           
           const res = await fetch('http://localhost:8001/api/sign', {
              method: 'POST',
              body: formData
           });
           
           if (!res.ok) {
              const err = await res.json();
              throw new Error("Signing failed: " + (err.error || "Unknown error"));
           }
           
           pdfBytes = new Uint8Array(await res.arrayBuffer());
        }
"""
content = content.replace("let pdfBytes = await pdfLibDoc.save();", pki_export)

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
