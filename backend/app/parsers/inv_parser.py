import pdfplumber
import re
import io
from datetime import datetime


def parse_inv_pdf(content: bytes) -> dict:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        page = pdf.pages[0]
        text = page.extract_text()

    inv_number = re.search(r"INV-\d+", text)
    so_number = re.search(r"SO-\d+", text)
    inv_date = re.search(r"\d{1,2}/\d{1,2}/\d{4}", text)

    parts = []
    for line in text.split("\n"):
        match = re.match(r"^(\S+-N)\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$", line)
        if match:
            parts.append({
                "part_number": match.group(1).replace("-N", ""),
                "quantity": int(match.group(2)),
                "description": match.group(3).strip(),
            })

    date_val = inv_date.group() if inv_date else None
    date_parsed = datetime.strptime(date_val, "%m/%d/%Y").strftime("%Y-%m-%d") if date_val else None

    return {
        "inv_number": inv_number.group() if inv_number else None,
        "so_number": so_number.group() if so_number else None,
        "inv_date": date_parsed,
        "parts": parts,
    }