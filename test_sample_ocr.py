import sys
import numpy as np
from PIL import Image
import fitz  # PyMuPDF
try:
    import easyocr
except ImportError:
    print("easyocr not installed")
    sys.exit(1)

# Render PDF to image
doc = fitz.open('sample_pdf.pdf')
page = doc[0]
pix = page.get_pixmap(dpi=150) # similar to scale=2.0 at 72dpi
img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
img_np = np.array(img)

reader = easyocr.Reader(['en'], gpu=False)
results = reader.readtext(img_np, paragraph=False)

print(f"Total blocks detected: {len(results)}")
for bbox, text, prob in results:
    print(f"[{text}] (prob: {prob:.2f})")

