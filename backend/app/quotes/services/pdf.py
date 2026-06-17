"""Generador del PDF del quote (entregable principal).

Service puro: recibe el dict que entrega `quote_detail_json` (RPC de Supabase)
y devuelve los bytes del PDF. Sin HTTP, sin DB. Disena el documento a mano
desde los datos, calcando el template Client_quote del .xltm.

Regla de oro: el PDF del cliente NUNCA muestra el costo MADISA ni nada del
proveedor. Solo datos comerciales.
"""
import os
import base64
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Ruta de las DLL de GTK/Pango en Windows (MSYS2). Configurable vía .env
# (WEASYPRINT_WIN_DLL_DIR). En Linux/Render esto se ignora: las librerías
# están en el sistema.
_WIN_DLL = os.getenv("WEASYPRINT_WIN_DLL_DIR", r"C:\msys64\mingw64\bin")
if os.name == "nt" and os.path.isdir(_WIN_DLL):
    os.environ.setdefault("WEASYPRINT_DLL_DIRECTORIES", _WIN_DLL)

from weasyprint import HTML  # noqa: E402

AMBER = "#FFC000"
_ASSETS = Path(__file__).parent / "assets"

COMPANY = {
    "name": "SEVEN ROADS GROUP",
    "lines": [
        "8109 NW 29TH STREET",
        "MIAMI FL 33122",
        "+1 (305) 377-8997",
        "PARTS@SEVENROADSGROUP.COM",
        "WWW.SEVENROADSGROUP.COM",
    ],
}

LEGAL = (
    "Payment options:\n"
    "1) Wire transfer (TT transfer)/ ACH Payment\n"
    "2) Zelle (parts@sevenroadsgroup.com)\n"
    "3) Credit card\n"
    "Credit Card Purchases Incur a 4% Transaction Fee\n\n"
    "Orders cannot be cancelled. It is customer responsibility to provide the "
    "correct part number. No returns or refunds are accepted\n"
    "Ordenes una vez procesado no se puede cancelar. Es responsabilidad del "
    "cliente proporcionar el numero de pieza correcto. No se aceptan "
    "devoluciones ni reembolsos\n\n"
    "Due to manufacture regulations, if the part is exported out of the USA, "
    "Seven Roads Group will not offer any warranty.\n"
    "Debido a las regulaciones de fabricacion, si la pieza se exporta fuera de "
    "los Estados Unidos, Seven Roads Group no ofrecera ninguna garantia."
)


def _logo_data_uri() -> str:
    data = (_ASSETS / "srg_oval.webp").read_bytes()
    return "data:image/webp;base64," + base64.b64encode(data).decode()


def _money(v) -> str:
    if v is None or v == 0:
        return ""
    return f"${v:,.2f}"


def _weight(v) -> str:
    if v is None or v == 0:
        return ""
    return f"{v:,.2f}"


def _num(v) -> str:
    if v in (None, 0):
        return ""
    return f"{v:g}"


def _esc(s) -> str:
    if s is None:
        return ""
    return (
        str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )


def _format_date(raw) -> str:
    # quote_date llega como 'YYYY-MM-DD'; el template muestra MM-DD-YYYY
    if not raw:
        return ""
    s = str(raw)
    parts = s.split("-")
    if len(parts) == 3 and len(parts[0]) == 4:
        y, m, d = parts
        return f"{m}-{d}-{y}"
    return s


def _build_html(quote: dict, internal: bool = False) -> str:
    lines = quote.get("lines", [])

    rows = []
    total_weight = 0.0
    for ln in lines:
        up = ln.get("unit_price")
        qty = ln.get("quantity") or 0
        in_stock = up is not None  # sin stock = sin precio
        if in_stock:
            uw = ln.get("unit_weight") or 0
            tp = (up or 0) * qty
            tw = uw * qty
            total_weight += tw
            up_s, tp_s = _money(up), _money(tp)
            uw_s, tw_s = _weight(uw), _weight(tw)
        else:
            # sin stock: no se muestra ninguna informacion de precio ni peso
            up_s = tp_s = uw_s = tw_s = ""

        rows.append(
            "<tr>"
            f'<td class="c">{_num(ln.get("item_number"))}</td>'
            f'<td class="c">{_esc(ln.get("brand"))}</td>'
            f'<td class="c">{_num(qty)}</td>'
            f'<td class="l">{_esc(ln.get("part_number"))}</td>'
            f'<td class="l">{_esc(ln.get("description"))}</td>'
            + (f'<td class="r madisa">{_money(ln.get("madisa_cost"))}</td>' if internal else "")
            + f'<td class="r">{up_s}</td>'
            f'<td class="r calc">{tp_s}</td>'
            f'<td class="r">{uw_s}</td>'
            f'<td class="r calc">{tw_s}</td>'
            f'<td class="c">{_num(ln.get("minimum_qty"))}</td>'
            f'<td class="l">{_esc(ln.get("notes"))}</td>'
            "</tr>"
        )

    # total de precio: viene calculado del helper (fuente de verdad)
    total_amount = quote.get("total_amount") or 0
    ship = quote.get("shipping_cost")
    ship_s = _money(ship) if ship not in (None, 0) else "Pendiente"

    meta = {
        "quote_number": _esc(quote.get("quote_number")),
        "date": _format_date(quote.get("quote_date")),
        "sales_rep": _esc(quote.get("sales_rep_name")),
        "client": _esc(quote.get("client_name")),
    }
    company_lines = "<br>".join(_esc(x) for x in COMPANY["lines"])
    legal_html = _esc(LEGAL).replace("\n", "<br>")
    madisa_th = '<th class="madisa">MADISA COST</th>' if internal else ''
    span_total = 7 if internal else 6
    span_ship_end = 5 if internal else 4

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@page {{
  size: letter landscape;
  margin: 1.2cm 1cm;
  @bottom-right {{ content: "Page " counter(page) " of " counter(pages);
    font: 8pt Arial; color:#888; }}
}}
* {{ box-sizing: border-box; }}
body {{ font-family: Arial, sans-serif; font-size: 9pt; color:#111; margin:0; }}
.head {{ display:flex; align-items:flex-start; justify-content:space-between;
  margin-bottom:14px; }}
.brand {{ display:flex; align-items:center; gap:14px; }}
.brand img {{ height:74px; }}
.brand .co-name {{ font-size:14pt; font-weight:bold; letter-spacing:.5px; }}
.brand .co-lines {{ font-size:8.5pt; line-height:1.45; color:#222;
  margin-top:3px; }}
.meta {{ border-collapse:collapse; }}
.meta td {{ padding:3px 10px; font-size:9.5pt; }}
.meta .k {{ background:{AMBER}; font-weight:bold; text-align:left;
  white-space:nowrap; }}
.meta .v {{ text-align:right; font-weight:bold; border-bottom:1px solid #ddd; }}
table.items {{ width:100%; border-collapse:collapse; }}
table.items thead th {{ background:{AMBER}; color:#000; font-weight:bold;
  font-size:8.5pt; padding:5px 4px; border:1px solid #d4a800;
  text-align:center; }}
table.items tbody td {{ padding:3px 4px; border:1px solid #e3e3e3;
  font-size:8.5pt; vertical-align:middle; }}
table.items thead {{ display:table-header-group; }}
table.items tr {{ break-inside:avoid; }}
.c {{ text-align:center; }} .l {{ text-align:left; }} .r {{ text-align:right; }}
.calc {{ color:#555; }}
.madisa {{ background:#eef2f7; color:#3b5b7a; }}
tbody tr:nth-child(even) td {{ background:#fcfcfa; }}
table.items tbody td.madisa {{ background:#eef2f7; }}
table.items thead th.madisa {{ background:#dbe4ee; }}
table.items tfoot {{ display:table-row-group; }}
table.items tfoot td {{ padding:5px 4px; font-size:9pt;
  border:1px solid #d4a800; border-top:2px solid #111; break-inside:avoid; }}
.t-lbl {{ background:{AMBER}; font-weight:bold; text-align:right; }}
.t-val {{ text-align:right; font-weight:bold; }}
.legal {{ margin-top:14px; font-size:7.5pt; line-height:1.5; color:#333;
  border-top:2px solid {AMBER}; padding-top:8px; break-inside:avoid; }}
</style></head><body>

<div class="head">
  <div class="brand">
    <img src="{_logo_data_uri()}">
    <div>
      <div class="co-name">{COMPANY['name']}</div>
      <div class="co-lines">{company_lines}</div>
    </div>
  </div>
  <table class="meta">
    <tr><td class="k">QUOTE #:</td><td class="v">{meta['quote_number']}</td></tr>
    <tr><td class="k">DATE:</td><td class="v">{meta['date']}</td></tr>
    <tr><td class="k">SALES REP:</td><td class="v">{meta['sales_rep']}</td></tr>
    <tr><td class="k">CLIENT:</td><td class="v">{meta['client']}</td></tr>
  </table>
</div>

<table class="items">
  <thead><tr>
    <th>#</th><th>Brand</th><th>QTY</th><th>PART#</th><th>DESCRIPTION</th>{madisa_th}
    <th>UNIT PRICE</th><th>TOTAL PRICE</th><th>UNIT WEIGHT</th>
    <th>TOTAL WEIGHT</th><th>MINIMUM QTY</th><th>NOTES</th>
  </tr></thead>
  <tbody>{''.join(rows)}</tbody>
  <tfoot>
    <tr>
      <td class="t-lbl" colspan="{span_total}">Total (USD)</td>
      <td class="t-val">{_money(total_amount)}</td>
      <td class="t-lbl">Total weight (LBS)</td>
      <td class="t-val">{_weight(total_weight)}</td>
      <td colspan="2"></td>
    </tr>
    <tr>
      <td class="t-lbl" colspan="{span_total}">Shipping cost (USD)</td>
      <td class="t-val">{ship_s}</td>
      <td colspan="{span_ship_end}"></td>
    </tr>
  </tfoot>
</table>

<div class="legal">{legal_html}</div>

</body></html>"""


def build_quote_html(quote: dict) -> str:
    """Devuelve el HTML del documento del quote, para el preview en pantalla.
    Mismo HTML que alimenta el PDF: una sola fuente de verdad del diseno.
    Si el quote no trae quote_number ni quote_date (preview pre-confirmacion),
    esos campos salen vacios."""
    return _build_html(quote, internal=True)


def generate_quote_pdf(quote: dict) -> bytes:
    """Recibe el dict de quote_detail_json y devuelve los bytes del PDF."""
    html = _build_html(quote)
    return HTML(string=html, base_url=str(_ASSETS)).write_pdf()
