from io import BytesIO
from pyhanko.sign import signers
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
import inspect

print("sign_pdf signature:", inspect.signature(signers.sign_pdf))
