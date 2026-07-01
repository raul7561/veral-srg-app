import pdfplumber
import re
import io


def parse_vex_pdf(content: bytes) -> dict:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        page = pdf.pages[0]
        text = page.extract_text()

    vex_number = re.search(r"VEX\s*(\d+)", text, re.IGNORECASE)
    vex_date = re.search(r"(\d{4}-\d{2}-\d{2})T", text)

    parts = []
    for line in text.split("\n"):
        match = re.match(
            r"^([0-9A-Z]+-[0-9A-Z]+)\s+\[\d+\]\s+.+?\s+(\d+\.\d{3})\s+H\d+",
            line,
        )
        if match:
            parts.append({
                "part_number": match.group(1).replace("-", ""),
                "quantity": int(float(match.group(2))),
            })

    return {
        "vex_number": f"VEX-{vex_number.group(1)}" if vex_number else None,
        "vex_date": vex_date.group(1) if vex_date else None,
        "parts": parts,
    }
