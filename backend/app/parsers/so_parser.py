import pdfplumber
import re
import io
from datetime import datetime


def parse_so_pdf(content: bytes) -> dict:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        full_text = "\n".join(page.extract_text() for page in pdf.pages)
        first_page = pdf.pages[0]
        words = first_page.extract_words()
        page_mid = first_page.width / 2

    so_number = re.search(r"SO-\d+", full_text)
    so_date = re.search(r"\d{1,2}/\d{1,2}/\d{4}", full_text)

    client_words = []
    capture = False
    skip = {"Ship", "To"}
    for w in words:
        if w["text"] == "Address":
            capture = True
            continue
        if capture and w["text"] in ["Customer", "Item", "Orders"]:
            break
        if capture and w["text"] in skip:
            continue
        if capture and float(w["x0"]) < page_mid * 0.7:
            client_words.append(w)

    first_y = client_words[0]["top"] if client_words else None
    first_line = [w["text"] for w in client_words if first_y and abs(w["top"] - first_y) < 5]
    client = " ".join(first_line) if first_line else "NOT FOUND"
    ship_to = "NOT PARSED"

    parts = []
    full_lines = full_text.split("\n")

    for line in full_lines:
        match = (
            re.match(r"^(\S+-N)\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+\d+\s+\d+\s+([\d,]+\.\d{2})$", line) or
            re.match(r"^(\S+-N)\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+\d+\s+([\d,]+\.\d{2})$", line) or
            re.match(r"^(\S+-N)\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$", line)
        )
        if match:
            parts.append({
                "part_number": match.group(1),
                "quantity": int(match.group(2)),
                "description": match.group(3).strip(),
                "rate": float(match.group(4).replace(",", "")),
            })

    date_val = so_date.group() if so_date else None
    date_parsed = datetime.strptime(date_val, "%m/%d/%Y").strftime("%Y-%m-%d") if date_val else None

    return {
        "so_number": so_number.group() if so_number else None,
        "so_date": date_parsed,
        "client": client,
        "ship_to": ship_to,
        "parts": parts,
    }