import re

with open("src/components/PdfViewer.jsx", "r") as f:
    content = f.read()

forms_logic = """
          // Form Fields
          const pageFields = newFormFields[pId];
          if (pageFields && pageFields.length > 0) {
            const form = pdfLibDoc.getForm() || pdfLibDoc.catalog.getOrCreateForm();
            for (const field of pageFields) {
              try {
                if (field.type === 'Tx') {
                  const f = form.createTextField(field.name);
                  f.addToPage(page, { x: field.pdfX, y: field.pdfY, width: field.pdfW, height: field.pdfH });
                } else if (field.type === 'Btn') {
                  const f = form.createCheckBox(field.name);
                  f.addToPage(page, { x: field.pdfX, y: field.pdfY, width: field.pdfW, height: field.pdfH });
                }
              } catch (e) {
                 console.warn("Could not create field", e);
              }
            }
          }
"""

content = content.replace("          // Redactions", forms_logic + "\n          // Redactions")

with open("src/components/PdfViewer.jsx", "w") as f:
    f.write(content)
