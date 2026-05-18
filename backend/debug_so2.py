import pdfplumber
import io

with open(r"C:\Users\rault\OneDrive\Attachments\SO-63562.pdf", "rb") as f:
    content = f.read()

with pdfplumber.open(io.BytesIO(content)) as pdf:
    page = pdf.pages[0]
    text = page.extract_text()

lines = text.split('\n')
for i, line in enumerate(lines):
    if any(k in line for k in ["Name", "Address", "Ship", "PERIPARTS", "Customer PO"]):
        print(f"{i:3}: {repr(line)}")
