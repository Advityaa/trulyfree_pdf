import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

metadata_logic = """
        // Apply Metadata
        if (metadataConfig.title) pdfLibDoc.setTitle(metadataConfig.title);
        if (metadataConfig.author) pdfLibDoc.setAuthor(metadataConfig.author);
        if (metadataConfig.subject) pdfLibDoc.setSubject(metadataConfig.subject);
        if (metadataConfig.keywords) pdfLibDoc.setKeywords(metadataConfig.keywords.split(',').map(k => k.trim()));
        if (metadataConfig.creator) pdfLibDoc.setCreator(metadataConfig.creator);
        if (metadataConfig.producer) pdfLibDoc.setProducer(metadataConfig.producer);
        
        pdfLibDoc.setModificationDate(new Date());
"""

content = content.replace("// Apply Encryption", metadata_logic + "\n        // Apply Encryption")

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
