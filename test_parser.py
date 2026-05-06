import pdfplumber
import re

with pdfplumber.open("INV-33883.pdf") as pdf:
    page = pdf.pages[0]
    text = page.extract_text()
    words = page.extract_words()
    page_mid = page.width / 2

# Extraer campos clave del texto
inv_number = re.search(r"INV-\d+", text)
so_number = re.search(r"SO-\d+", text)
date = re.search(r"\d{1,2}/\d{1,2}/\d{4}", text)

print("INV:", inv_number.group() if inv_number else "NOT FOUND")
print("SO:", so_number.group() if so_number else "NOT FOUND")
print("Date:", date.group() if date else "NOT FOUND")

# Extraer cliente por coordenadas (columna izquierda)
consignee_words = []
capture = False
for w in words:
    if w["text"] == "Consignee":
        capture = True
        continue
    if capture and w["text"] in ["S.O.", "Item"]:
        break
    if capture and float(w["x0"]) < page_mid:
        consignee_words.append(w["text"])

print("Client:", " ".join(consignee_words[:4]))

# Extraer líneas de partes
lines = text.split("\n")
parts = []
for line in lines:
    match = re.match(r"^(\S+-N)\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$", line)
    if match:
        parts.append({
            "part_number": match.group(1),
            "quantity": int(match.group(2)),
            "description": match.group(3).strip(),
            "unit_price": match.group(4),
            "total": match.group(5)
        })

for p in parts:
    print(p)