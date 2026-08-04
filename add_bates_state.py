import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

# Add Hash icon
content = re.sub(r"(import {.*?)(, Info)(.*?from 'lucide-react';)", r"\1\2, Hash\3", content)

state_vars = """
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
"""
content = content.replace("  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);", state_vars + "\n  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);")

toolbar_btn = """
              <button className={`tool-btn ${isBatesModalOpen ? 'active' : ''}`} onClick={() => setIsBatesModalOpen(!isBatesModalOpen)} title="Bates Numbering">
                <Hash size={18} />
              </button>
"""
content = content.replace('<button className={`tool-btn ${isMetadataModalOpen ? \'active\' : \'\'}`} onClick={() => setIsMetadataModalOpen(!isMetadataModalOpen)} title="Metadata">', toolbar_btn + '              <button className={`tool-btn ${isMetadataModalOpen ? \'active\' : \'\'}`} onClick={() => setIsMetadataModalOpen(!isMetadataModalOpen)} title="Metadata">')

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
