import fitz

doc = fitz.open('sample_pdf.pdf')
page = doc[0]

words = page.get_text("words")

for w in words:
    # y0 is between 190 and 220
    if 190 < w[1] < 220:
        print(w)

