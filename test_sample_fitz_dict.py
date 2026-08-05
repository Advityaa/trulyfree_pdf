import fitz

doc = fitz.open('sample_pdf.pdf')
page = doc[0]

text_dict = page.get_text("dict")

for block in text_dict["blocks"]:
    if "lines" in block:
        for line in block["lines"]:
            for span in line["spans"]:
                if "Ayushi" in span["text"] or "Name" in span["text"] or ":" in span["text"]:
                    print(span)

