import pdfplumber
import re
import io
from datetime import datetime


def parse_so_pdf(content: bytes) -> dict:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        page = pdf.pages[0]
        text = page.extract_text()

    so_number = re.search(r"SO-\d+", text)
    so_date = re.search(r"\d{1,2}/\d{1,2}/\d{4}", text)

    lines = text.split("\n")
    client_lines = []
    ship_lines = []
    mode = None

    for line in lines:
        stripped = line.strip()
        if "Name / Address" in stripped:
            mode = "client"
            # la misma línea puede contener "Ship To" al lado
            continue
        if mode == "client" and "Ship To" in stripped:
            # tomar solo lo que está antes de "Ship To"
            left = stripped.split("Ship To")[0].strip()
            if left:
                client_lines.append(left)
            mode = "ship"
            continue
        if "Customer PO No." in stripped or stripped.startswith("Customer PO"):
            break
        if mode == "client" and stripped:
            client_lines.append(stripped)
        elif mode == "ship" and stripped:
            ship_lines.append(stripped)

    client = client_lines[0] if client_lines else "NOT FOUND"
    ship_to = ship_lines[0] if ship_lines else "NOT FOUND"

    parts = []
    for line in lines:
        match = re.match(r"^(\S+-N)\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$", line)
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