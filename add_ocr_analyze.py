import re

with open("backend/main.py", "r") as f:
    content = f.read()

# Add endpoints
endpoints = """
@app.post("/api/ocr/analyze")
async def analyze_ocr(file: UploadFile = File(...)):
    if reader is None:
        return {"success": False, "error": "EasyOCR is not installed yet."}
    try:
        contents = await file.read()
        image = Image.open(BytesIO(contents))
        # Ensure image is in RGB
        if image.mode != 'RGB':
            image = image.convert('RGB')
            
        img_np = np.array(image)
        
        # We use paragraph=False to ensure granular bounding boxes.
        results = reader.readtext(img_np, paragraph=False)
        
        blocks = []
        for (bbox, text, prob) in results:
            # bbox is [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
            x1, y1 = bbox[0]
            x2, y2 = bbox[2]
            
            # Convert numpy types to native Python types for JSON serialization
            blocks.append({
                "text": text,
                "x": float(x1),
                "y": float(y1),
                "width": float(x2 - x1),
                "height": float(y2 - y1),
                "prob": float(prob)
            })
            
        return {"success": True, "blocks": blocks}
    except Exception as e:
        return {"success": False, "error": str(e)}
"""

content = content.replace("@app.post(\"/api/convert/xlsx\")", endpoints + "\n@app.post(\"/api/convert/xlsx\")")

with open("backend/main.py", "w") as f:
    f.write(content)
