import fitz

doc = fitz.open('sample_pdf.pdf')
page = doc[0]

# get words as (x0, y0, x1, y1, "word", block_no, line_no, word_no)
words = page.get_text("words")

# print words near "Name" or "Pincode" to see spacing
for w in words:
    text = w[4]
    if "Name" in text or "Pincode" in text or "Ayushi" in text or "Aggarwal" in text or "122003" in text:
        print(w)

