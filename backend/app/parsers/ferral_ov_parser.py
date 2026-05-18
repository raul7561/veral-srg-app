import pdfplumber
import re
import io


def parse_ferral_ov_pdf(content: bytes) -> dict:
    full_text = ""
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            full_text += page.extract_text() + "\n"

    ferral_order_number = re.search(r"N°\s*de\s*Pedido\s+(\d+)", full_text)
    ferral_date = re.search(r"Fecha:\s+(\d{4}-\d{2}-\d{2})", full_text)
    so_number = re.search(r"SO-\d+", full_text)
    po_number = re.search(r"PO-\d+", full_text)

    madisa_ov = None
    ov_match = re.search(r"(OV\d+)", full_text)
    if ov_match:
        madisa_ov = ov_match.group(1)

    lines = full_text.split("\n")
    parts = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Caso normal: parte_number descripcion OV cantidad PZA precio total
        match = re.match(
            r"^([A-Z0-9]+)\s+(.+?)\s+(OV\d+)\s+([\d.]+)\s+PZA\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)$",
            line
        )
        if match:
            parts.append({
                "part_number": match.group(1),
                "description": match.group(2).strip(),
                "madisa_ov": match.group(3),
                "quantity": float(match.group(4)),
                "price": float(match.group(5).replace(",", "")),
                "total": float(match.group(6).replace(",", "")),
            })
            i += 1
            continue

        # Caso precio partido: linea termina en total pero falta precio unitario
        match_split = re.match(
            r"^([A-Z0-9]+)\s+(.+?)\s+(OV\d+)\s+([\d.]+)\s+PZA\s+([\d,]+\.\d+)$",
            line
        )
        if match_split:
            total = float(match_split.group(5).replace(",", ""))
            # El precio unitario está en la línea siguiente (ignoramos las líneas de desborde)
            # Saltamos las siguientes líneas que son solo números
            j = i + 1
            while j < len(lines) and re.match(r"^\s*[\d,]+\.?\d*\s*$", lines[j].strip()):
                j += 1
            parts.append({
                "part_number": match_split.group(1),
                "description": match_split.group(2).strip(),
                "madisa_ov": match_split.group(3),
                "quantity": float(match_split.group(4)),
                "price": None,
                "total": total,
            })
            i = j
            continue

        i += 1

    return {
        "ferral_order_number": ferral_order_number.group(1) if ferral_order_number else None,
        "ferral_date": ferral_date.group(1) if ferral_date else None,
        "so_number": so_number.group() if so_number else None,
        "po_number": po_number.group() if po_number else None,
        "madisa_ov": madisa_ov,
        "parts": parts,
    }