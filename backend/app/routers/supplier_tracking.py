from fastapi import APIRouter, UploadFile, File, HTTPException
from app.database import supabase_admin as supabase, supabase_admin
from app.parsers.so_parser import parse_so_pdf

router = APIRouter(prefix="/supplier-tracking", tags=["supplier-tracking"])


def fetch_all(table_name, select_clause):
    rows = []
    start = 0
    page_size = 1000
    while True:
        resp = supabase.table(table_name).select(select_clause).range(start, start + page_size - 1).execute()
        batch = resp.data
        rows.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size
    return rows


@router.post("/orders")
async def create_supplier_order(file: UploadFile = File(...)):
    content = await file.read()
    parsed = parse_so_pdf(content)

    so = parsed["so_number"]
    if not so:
        raise HTTPException(status_code=400, detail="SO number not found in PDF")

    existing = supabase.table("supplier_orders").select("id").eq("so_number", so).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"{so} already exists in Supplier Tracking")

    # Buscar match en customers por nombre
    customer_id = None
    if parsed["client"] and parsed["client"] != "NOT FOUND":
        customer_match = supabase.table("customers").select("id").ilike("name", parsed["client"]).execute()
        if customer_match.data:
            customer_id = customer_match.data[0]["id"]

    result = supabase.table("supplier_orders").insert({
        "so_number": so,
        "order_date": parsed["so_date"],
        "client": parsed["client"],
        "customer_id": customer_id,
    }).execute()

    supplier_order_id = result.data[0]["id"]

    for p in parsed["parts"]:
        part_number_clean = p["part_number"].replace("-N", "")
        supabase.table("supplier_order_lines").insert({
            "supplier_order_id": supplier_order_id,
            "part_number": part_number_clean,
            "description": p["description"],
            "quantity": p["quantity"],
            "status": "pending",
        }).execute()

    try:
        path = f"{so}/{file.filename}"
        supabase_admin.storage.from_("documents").upload(path, content, {"content-type": "application/pdf", "upsert": "true"})
        url = supabase_admin.storage.from_("documents").get_public_url(path)
        supabase.table("supplier_orders").update({"so_pdf_url": url}).eq("id", supplier_order_id).execute()
    except Exception:
        pass        


    return {
        "so_number": so,
        "supplier_order_id": supplier_order_id,
        "parts_count": len(parsed["parts"])
    }


@router.get("/orders")
def get_supplier_orders(page: int = 1, limit: int = 25, sort_by: str = "newest"):
    start = (page - 1) * limit
    end = start + limit - 1
    query = supabase.table("supplier_orders").select("*", count="exact")
    if sort_by == "oldest":
        query = query.order("order_date", desc=False)
    elif sort_by == "az":
        query = query.order("client", desc=False)
    else:
        query = query.order("created_at", desc=True)
    resp = query.range(start, end).execute()
    orders = resp.data
    total_count = resp.count
    all_lines = fetch_all("supplier_order_lines", "supplier_order_id, status")
    all_invs = fetch_all("supplier_invs", "*")
    all_vex = fetch_all("supplier_vex", "*")

    result = []
    for order in orders:
        oid = order["id"]
        lines = [l for l in all_lines if l["supplier_order_id"] == oid]
        total = len(lines)
        received = sum(1 for l in lines if l["status"] == "received")
        invs = [i for i in all_invs if i["supplier_order_id"] == oid]

        for inv in invs:
            inv["vex"] = [v for v in all_vex if v["supplier_inv_id"] == inv["id"]]

        if total == 0:
            fulfillment = "awaiting_parts"
        elif received == 0:
            fulfillment = "pending"
        elif received < total:
            fulfillment = "in_progress"
        else:
            fulfillment = "complete"

        result.append({
            **order,
            "client": order.get("client") or "—",
            "total_lines": total,
            "received_lines": received,
            "fulfillment": fulfillment,
            "invs": invs,
        })

    return {"rows": result, "total": total_count}


@router.get("/orders/by-number/{so_number}")
def get_supplier_order_by_number(so_number: str):
    resp = supabase.table("supplier_orders").select("*").eq("so_number", so_number).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail=f"{so_number} not found")
    order = resp.data[0]
    oid = order["id"]
    lines = supabase.table("supplier_order_lines").select("supplier_order_id, status").eq("supplier_order_id", oid).execute().data
    invs = supabase.table("supplier_invs").select("*").eq("supplier_order_id", oid).execute().data
    all_vex = fetch_all("supplier_vex", "*")

    total = len(lines)
    received = sum(1 for l in lines if l["status"] == "received")

    for inv in invs:
        inv["vex"] = [v for v in all_vex if v["supplier_inv_id"] == inv["id"]]

    if total == 0:
        fulfillment = "awaiting_parts"
    elif received == 0:
        fulfillment = "pending"
    elif received < total:
        fulfillment = "in_progress"
    else:
        fulfillment = "complete"

    return {
        **order,
        "client": order.get("client") or "—",
        "total_lines": total,
        "received_lines": received,
        "fulfillment": fulfillment,
        "invs": invs,
    }


@router.get("/orders/{so_number}/lines-by-so")
def get_lines_by_so(so_number: str):
    order = supabase.table("supplier_orders").select("id").eq("so_number", so_number).execute()
    if not order.data:
        raise HTTPException(status_code=404, detail=f"{so_number} not found")
    supplier_order_id = order.data[0]["id"]
    lines = supabase.table("supplier_order_lines").select("*").eq("supplier_order_id", supplier_order_id).execute().data
    return lines


@router.post("/attach/po")
async def attach_po(file: UploadFile = File(...)):
    from app.parsers.po_parser import parse_po_pdf

    content = await file.read()
    parsed = parse_po_pdf(content)

    if not parsed["po_number"]:
        raise HTTPException(status_code=400, detail="PO number not found in PDF")
    if not parsed["so_number"]:
        raise HTTPException(status_code=400, detail="SO number not found in PDF")

    order = supabase.table("supplier_orders").select("id").eq("so_number", parsed["so_number"]).execute()
    if not order.data:
        raise HTTPException(status_code=404, detail=f"{parsed['so_number']} not found in Supplier Tracking")

    supabase.table("supplier_orders").update({
        "po_number": parsed["po_number"],
    }).eq("so_number", parsed["so_number"]).execute()

    try:
        path = f"{parsed['so_number']}/{file.filename}"
        supabase_admin.storage.from_("documents").upload(path, content, {"content-type": "application/pdf", "upsert": "true"})
        url = supabase_admin.storage.from_("documents").get_public_url(path)
        supabase.table("supplier_orders").update({"po_pdf_url": url}).eq("so_number", parsed["so_number"]).execute()
    except Exception:
        pass

    return {
        "so_number": parsed["so_number"],
        "po_number": parsed["po_number"],
        "vendor": parsed["vendor"],
    }


@router.post("/attach/ferral-ov")
async def attach_ferral_ov(file: UploadFile = File(...)):
    from app.parsers.ferral_ov_parser import parse_ferral_ov_pdf

    content = await file.read()
    parsed = parse_ferral_ov_pdf(content)

    if not parsed["ferral_order_number"]:
        raise HTTPException(status_code=400, detail="Ferral order number not found in PDF")
    if not parsed["so_number"]:
        raise HTTPException(status_code=400, detail="SO number not found in PDF")

    order = supabase.table("supplier_orders").select("id").eq("so_number", parsed["so_number"]).execute()
    if not order.data:
        raise HTTPException(status_code=404, detail=f"{parsed['so_number']} not found in Supplier Tracking")

    supplier_order_id = order.data[0]["id"]

    supabase.table("supplier_orders").update({
        "ferral_order_number": parsed["ferral_order_number"],
        "madisa_ov": parsed["madisa_ov"],
    }).eq("so_number", parsed["so_number"]).execute()

    if parsed["madisa_ov"]:
        supabase.table("supplier_order_lines").update({
            "madisa_ov": parsed["madisa_ov"],
        }).eq("supplier_order_id", supplier_order_id).execute()

    try:
        path = f"{parsed['so_number']}/{file.filename}"
        supabase_admin.storage.from_("documents").upload(path, content, {"content-type": "application/pdf", "upsert": "true"})
        url = supabase_admin.storage.from_("documents").get_public_url(path)
        supabase.table("supplier_orders").update({"ferral_ov_pdf_url": url}).eq("so_number", parsed["so_number"]).execute()
    except Exception:
        pass    

    return {
        "ferral_order_number": parsed["ferral_order_number"],
        "madisa_ov": parsed["madisa_ov"],
        "so_number": parsed["so_number"],
        "parts_count": len(parsed["parts"]),
    }


@router.post("/attach/inv")
async def attach_inv(file: UploadFile = File(...)):
    from app.parsers.inv_parser import parse_inv_pdf

    content = await file.read()
    parsed = parse_inv_pdf(content)

    if not parsed["inv_number"]:
        raise HTTPException(status_code=400, detail="INV number not found in PDF")
    if not parsed["so_number"]:
        raise HTTPException(status_code=400, detail="SO number not found in PDF")

    order = supabase.table("supplier_orders").select("id").eq("so_number", parsed["so_number"]).execute()
    if not order.data:
        raise HTTPException(status_code=404, detail=f"{parsed['so_number']} not found in Supplier Tracking")

    supplier_order_id = order.data[0]["id"]

    existing = supabase.table("supplier_invs").select("id").eq("inv_number", parsed["inv_number"]).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"{parsed['inv_number']} already exists")

    inv_result = supabase.table("supplier_invs").insert({
        "supplier_order_id": supplier_order_id,
        "inv_number": parsed["inv_number"],
        "inv_date": parsed["inv_date"],
    }).execute()

    supplier_inv_id = inv_result.data[0]["id"]

    for p in parsed["parts"]:
        supabase.table("supplier_inv_lines").insert({
            "supplier_inv_id": supplier_inv_id,
            "part_number": p["part_number"],
            "quantity": p["quantity"],
        }).execute()

    try:
        path = f"{parsed['so_number']}/{file.filename}"
        supabase_admin.storage.from_("documents").upload(path, content, {"content-type": "application/pdf", "upsert": "true"})
        url = supabase_admin.storage.from_("documents").get_public_url(path)
        supabase.table("supplier_invs").update({"inv_pdf_url": url}).eq("id", supplier_inv_id).execute()
    except Exception:
        pass    

    return {
        "so_number": parsed["so_number"],
        "inv_number": parsed["inv_number"],
        "inv_date": parsed["inv_date"],
        "parts_count": len(parsed["parts"]),
    }


@router.post("/orders/{so_number}/inv/{inv_number}/vex")
async def attach_vex(so_number: str, inv_number: str, file: UploadFile = File(...)):
    from app.parsers.vex_parser import parse_vex_pdf

    inv = supabase.table("supplier_invs").select("id").eq("inv_number", inv_number).execute()
    if not inv.data:
        raise HTTPException(status_code=404, detail=f"{inv_number} not found")

    supplier_inv_id = inv.data[0]["id"]

    content = await file.read()
    parsed = parse_vex_pdf(content)

    if not parsed["vex_number"]:
        raise HTTPException(status_code=400, detail="VEX number not found in PDF")

    existing = supabase.table("supplier_vex").select("id").eq("vex_number", parsed["vex_number"]).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"{parsed['vex_number']} already exists")

    vex_result = supabase.table("supplier_vex").insert({
        "supplier_inv_id": supplier_inv_id,
        "vex_number": parsed["vex_number"],
        "vex_date": parsed["vex_date"],
    }).execute()

    supplier_vex_id = vex_result.data[0]["id"]

    for p in parsed["parts"]:
        supabase.table("supplier_vex_lines").insert({
            "supplier_vex_id": supplier_vex_id,
            "part_number": p["part_number"],
            "quantity": p["quantity"],
        }).execute()

    try:
        inv_data = supabase.table("supplier_invs").select("supplier_order_id").eq("id", supplier_inv_id).execute()
        order_data = supabase.table("supplier_orders").select("so_number").eq("id", inv_data.data[0]["supplier_order_id"]).execute()
        so_for_path = order_data.data[0]["so_number"]
        path = f"{so_for_path}/{file.filename}"
        supabase_admin.storage.from_("documents").upload(path, content, {"content-type": "application/pdf", "upsert": "true"})
        url = supabase_admin.storage.from_("documents").get_public_url(path)
        supabase.table("supplier_vex").update({"vex_pdf_url": url}).eq("id", supplier_vex_id).execute()
    except Exception:
        pass

    return {
        "vex_number": parsed["vex_number"],
        "vex_date": parsed["vex_date"],
        "parts_count": len(parsed["parts"]),
    }


@router.post("/sync/madisa")
async def sync_madisa(file: UploadFile = File(...)):
    import pandas as pd
    import io as io_module
    from datetime import datetime, timedelta

    content = await file.read()
    df = pd.read_excel(io_module.BytesIO(content))
    df.columns = [c.strip() for c in df.columns]

    col_map = {
        "Orden Venta": "madisa_ov",
        "Número de Parte": "part_number",
        "Almacén CAT / MADISA": "warehouse",
        "Fecha Estimada Entrega": "eta_to_ferral",
        "Llave": "ferral_llave",
        "Guía Almex": "almex_guide",
        "HU No": "hu_number",
    }

    missing = [c for c in col_map if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing}")

    def parse_eta(val):
        if val is None:
            return None
        if isinstance(val, str) and val.strip().lower() == "pendiente":
            return None
        try:
            n = int(float(str(val)))
            return (datetime(1899, 12, 30) + timedelta(days=n)).strftime("%Y-%m-%d")
        except:
            return None

    def get_category(llave):
        if not llave:
            return None
        llave = str(llave).strip()
        if llave.startswith("00PO"):
            return "cross_dock"
        if llave.upper().startswith("PKJ"):
            return "pkj"
        return None

    all_lines = supabase.table("supplier_order_lines").select("id, madisa_ov, part_number").execute().data

    index = {}
    for line in all_lines:
        if not line.get("madisa_ov") or not line.get("part_number"):
            continue
        key = (line["madisa_ov"].strip(), line["part_number"].strip())
        if key not in index:
            index[key] = []
        index[key].append(line["id"])

    updated = 0
    skipped = 0

    for _, row in df.iterrows():
        madisa_ov = str(row["Orden Venta"]).strip() if pd.notna(row["Orden Venta"]) else None
        part_number = str(row["Número de Parte"]).strip() if pd.notna(row["Número de Parte"]) else None

        if not madisa_ov or not part_number:
            skipped += 1
            continue

        key = (madisa_ov, part_number)
        line_ids = index.get(key, [])

        if not line_ids:
            skipped += 1
            continue

        eta = parse_eta(row.get("Fecha Estimada Entrega"))
        llave = str(row["Llave"]).strip() if pd.notna(row.get("Llave")) else None
        almex = str(row["Guía Almex"]).strip() if pd.notna(row.get("Guía Almex")) else None
        hu = str(row["HU No"]).strip() if pd.notna(row.get("HU No")) else None
        warehouse = str(row["Almacén CAT / MADISA"]).strip() if pd.notna(row.get("Almacén CAT / MADISA")) else None
        category = get_category(llave)

        update_data = {
            "warehouse": warehouse,
            "eta_to_ferral": eta,
            "ferral_llave": llave,
            "almex_guide": almex,
            "hu_number": hu,
            "po_category": category,
        }

        for line_id in line_ids:
            supabase.table("supplier_order_lines").update(update_data).eq("id", line_id).execute()
            updated += 1

    return {
        "updated": updated,
        "skipped": skipped,
    }
