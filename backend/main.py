from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from io import BytesIO
import numpy as np
from PIL import Image

app = FastAPI()

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Try to load EasyOCR — it may not be installed yet
reader = None
try:
    import easyocr
    print("Loading EasyOCR model...")
    reader = easyocr.Reader(['en'], gpu=False)
    print("EasyOCR model loaded successfully.")
except ImportError:
    print("⚠️  EasyOCR not installed yet. OCR endpoint will return an error until it's installed.")
except Exception as e:
    print(f"⚠️  EasyOCR failed to load: {e}")

@app.get("/api/health")
async def health():
    return {"status": "ok", "ocr_ready": reader is not None}

@app.post("/api/ocr")
async def process_ocr(file: UploadFile = File(...)):
    if reader is None:
        return {"success": False, "error": "EasyOCR is not installed yet. Run: pip install easyocr"}
    try:
        contents = await file.read()
        image = Image.open(BytesIO(contents))
        img_np = np.array(image)
        
        results = reader.readtext(img_np)
        extracted_text = "\n".join([text for (_, text, _) in results])
        
        return {"success": True, "text": extracted_text}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
