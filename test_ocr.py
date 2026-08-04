import requests
from PIL import Image, ImageDraw
import io

img = Image.new('RGB', (200, 100), color='white')
d = ImageDraw.Draw(img)
d.text((10,10), "Hello OCR", fill=(0,0,0))
buf = io.BytesIO()
img.save(buf, format='JPEG')
buf.seek(0)

res = requests.post("http://localhost:8000/api/ocr", files={"file": ("test.jpg", buf, "image/jpeg")})
print(res.json())
