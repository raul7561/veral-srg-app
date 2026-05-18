import pdfplumber
import re
import io
from datetime import datetime


def parse_po_pdf(content: bytes) -> dict:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        page = pdf.pages[0]
        text = page.extract_text()
        words = page.extract_words()
        page_mid = page.width / 2

    po_number = re.search(r"PO-\d+", text)
    po_date = re.search(r"\d{1,2}/\d{1,2}/\d{4}", text)
    so_number = re.search(r"SO-\d+", text)

    capture = False
    vendor_words = []
    for w in words:
        if w["text"] == "Vendor":
            capture = True
            continue
        if capture and w["text"] in ["Sales", "Item"]:
            break
        if capture and float(w["x0"]) < page_mid:
            vendor_words.append(w["text"])

    vendor = " ".join(vendor_words[:5]) if vendor_words else "NOT FOUND"

    parts = []
    for line in text.split("\n"):
        match = re.match(r"^(\S+-N)\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+\d+\s+([\d,]+\.\d{2})$", line)
        if match:
            parts.append({
                "part_number": match.group(1).replace("-N", ""),
                "quantity": int(match.group(2)),
                "description": match.group(3).strip(),
                "rate": float(match.group(4).replace(",", "")),
            })

    date_val = po_date.group() if po_date else None
    date_parsed = datetime.strptime(date_val, "%m/%d/%Y").strftime("%Y-%m-%d") if date_val else None

    return {
        "po_number": po_number.group() if po_number else None,
        "po_date": date_parsed,
        "so_number": so_number.group() if so_number else None,
        "vendor": vendor,
        "parts": parts,
    }