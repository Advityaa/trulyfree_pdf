import fitz

doc = fitz.open('sample_pdf.pdf')
page = doc[0]

# Extract raw text words
words = page.get_text("words")
print(f"Total words found by fitz: {len(words)}")
for w in words[:10]:
    print(w)

