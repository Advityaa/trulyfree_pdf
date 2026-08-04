import re
with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

content = content.replace("from 'pdf-lib';", ", PDFString, PDFName } from 'pdf-lib';")

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
