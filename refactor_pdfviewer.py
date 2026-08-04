import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

# Replace state [pageNumber] with [activePageId]
content = content.replace("prev[pageNumber]", "prev[activePageId]")
content = content.replace("[pageNumber]: [", "[activePageId]: [")
content = content.replace("[pageNumber]: {", "[activePageId]: {")
content = content.replace("signatures[pageNumber]", "signatures[activePageId]")
content = content.replace("newFormFields[pageNumber]", "newFormFields[activePageId]")
content = content.replace("annotations[pageNumber]", "annotations[activePageId]")
content = content.replace("redactions[pageNumber]", "redactions[activePageId]")
content = content.replace("edits[pageNumber]", "edits[activePageId]")

# Update existing form fields filter
content = content.replace("f.pageNum === pageNumber", "f.pageNum === (activePage ? activePage.originalIndex + 1 : 1)")

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
