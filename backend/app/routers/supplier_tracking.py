import logging

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.database import supabase_admin as supabase, supabase_admin
from app.parsers.so_parser import parse_so_pdf
from app.auth import get_current_user

router = APIRouter(prefix="/supplier-tracking", tags=["supplier-tracking"])
logger = logging.getLogger(__name__)


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


def _delete_storage_file(pdf_url):
    if not pdf_url:
        return
    marker = "/documents/"
    if marker not in pdf_url:
        return
    path = pdf_url.split(marker, 1)[1].split("?", 1)[0]
    from urllib.parse import unquote
    path = unquote(path)
    try:
        supabase_admin.storage.from_("documents").remove([path])
    except Exception as exc:
        logger.warning("Storage remove failed for %s: %s", path, exc)


def compute_part_fulfillment(supplier_order_id, order_lines, invs, inv_lines, vex, vex_lines):
    """
    For one supplier order, compute part fulfillment from INV and VEX quantities.
    Cross-table matching uses part_number as stored, without normalization.
    """
    order_part_qty = {}
    for line in order_lines:
        if line.get("supplier_order_id") != supplier_order_id:
            continue
        pn = line["part_number"]
        order_part_qty[pn] = order_part_qty.get(pn, 0) + line["quantity"]

    order_inv_ids = {
        inv["id"]
        for inv in invs
        if inv.get("supplier_order_id") == supplier_order_id
    }

    invoiced = {}
    for line in inv_lines:
        if line.get("supplier_inv_id") not in order_inv_ids:
            continue
        pn = line["part_number"]
        invoiced[pn] = invoiced.get(pn, 0) + line["quantity"]

    order_vex_ids = {
        v["id"]
        for v in vex
        if v.get("supplier_inv_id") in order_inv_ids
    }

    received = {}
    for line in vex_lines:
        if line.get("supplier_vex_id") not in order_vex_ids:
            continue
        pn = line["part_number"]
        received[pn] = received.get(pn, 0) + line["quantity"]

    parts = []
    for pn, ordered in order_part_qty.items():
        invoiced_qty = invoiced.get(pn, 0)
        received_qty = received.get(pn, 0)
        if received_qty >= ordered:
            status = "complete"
        elif received_qty > 0:
            status = "partial"
        elif invoiced_qty < ordered:
            status = "not_invoiced"
        else:
            status = "pending"

        parts.append({
            "part_number": pn,
            "ordered": ordered,
            "invoiced": invoiced_qty,
            "received": received_qty,
            "pending_to_invoice": max(ordered - invoiced_qty, 0),
            "pending_to_receive": max(ordered - received_qty, 0),
            "pending_reason": (
                "invoice"
                if max(ordered - invoiced_qty, 0) > 0
                else "receive"
                if max(ordered - received_qty, 0) > 0
                else None
            ),
            "status": status,
        })

    return parts


def summarize_part_fulfillment(parts):
    parts_total = len(parts)
    parts_complete = sum(1 for part in parts if part["status"] == "complete")

    if parts_total == 0:
        order_status = "awaiting_parts"
    elif parts_complete == parts_total:
        order_status = "complete"
    elif any(part["received"] > 0 for part in parts):
        order_status = "in_progress"
    else:
        order_status = "pending"

    return {
        "parts_total": parts_total,
        "parts_complete": parts_complete,
        "order_status": order_status,
    }


@router.post("/orders")
async def create_supplier_order(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    parsed = parse_so_pdf(content)

    so = parsed["so_number"]
    if not so:
        raise HTTPException(status_code=400, detail="SO number not found in PDF")

    existing = supabase.table("supplier_orders").select("id").eq("so_number", so).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"{so} already exists in Supplier Tracking")

    if not parsed["parts"]:
        raise HTTPException(
            status_code=422,
            detail=f"{so} no contiene líneas de partes. Verifica que el PDF sea el Sales Order correcto y no un packing list u otro documento.",
        )

    # Buscar match en customers por nombre
    customer_id = None
    if parsed["client"] and parsed["client"] != "NOT FOUND":
        customer_match = supabase.table("customers").select("id").ilike("name", parsed["client"]).execute()
        if customer_match.data:
            customer_id = customer_match.data[0]["id"]

    unmatched_client = None
    if customer_id is None:
        unmatched_client = parsed["client"]

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

    pdf_uploaded = True
    try:
        path = f"{so}/{file.filename}"
        supabase_admin.storage.from_("documents").upload(path, content, {"content-type": "application/pdf", "upsert": "true"})
        url = supabase_admin.storage.from_("documents").get_public_url(path)
        supabase.table("supplier_orders").update({"so_pdf_url": url}).eq("id", supplier_order_id).execute()
    except Exception as exc:
        pdf_uploaded = False
        logger.warning("PDF storage upload failed for %s: %s", path, exc)


    return {
        "so_number": so,
        "supplier_order_id": supplier_order_id,
        "parts_count": len(parsed["parts"]),
        "unmatched_client": unmatched_client,
        "pdf_uploaded": pdf_uploaded,
    }


@router.get("/orders")
def get_supplier_orders(
    page: int = 1,
    limit: int = 25,
    sort_by: str = "newest",
    search: str = "",
    user: dict = Depends(get_current_user),
):
    start = (page - 1) * limit
    end = start + limit - 1
    query = supabase.table("supplier_orders").select("*", count="exact")
    search_term = search.strip()
    if search_term:
        pattern = f"%{search_term}%"
        query = query.or_(
            f"so_number.ilike.{pattern},client.ilike.{pattern},po_number.ilike.{pattern}"
        )
    if sort_by == "oldest":
        query = query.order("order_date", desc=False)
    elif sort_by == "so_asc":
        query = query.order("so_number", desc=False)
    elif sort_by == "so_desc":
        query = query.order("so_number", desc=True)
    elif sort_by == "client_az":
        query = query.order("client", desc=False)
    elif sort_by == "client_za":
        query = query.order("client", desc=True)
    else:
        query = query.order("created_at", desc=True)
    resp = query.range(start, end).execute()
    orders = resp.data
    total_count = resp.count

    order_ids = [o["id"] for o in orders]

    if order_ids:
        all_lines = (
            supabase.table("supplier_order_lines")
            .select("*")
            .in_("supplier_order_id", order_ids)
            .execute()
            .data
        )
        all_invs = (
            supabase.table("supplier_invs")
            .select("*")
            .in_("supplier_order_id", order_ids)
            .execute()
            .data
        )
        inv_ids = [inv["id"] for inv in all_invs]
        all_vex = (
            supabase.table("supplier_vex")
            .select("*")
            .in_("supplier_inv_id", inv_ids)
            .execute()
            .data
        ) if inv_ids else []
        all_inv_lines = (
            supabase.table("supplier_inv_lines")
            .select("*")
            .in_("supplier_inv_id", inv_ids)
            .execute()
            .data
        ) if inv_ids else []
        vex_ids = [v["id"] for v in all_vex]
        all_vex_lines = (
            supabase.table("supplier_vex_lines")
            .select("*")
            .in_("supplier_vex_id", vex_ids)
            .execute()
            .data
        ) if vex_ids else []
    else:
        all_lines = []
        all_invs = []
        all_vex = []
        all_inv_lines = []
        all_vex_lines = []

    customer_ids = [o["customer_id"] for o in orders if o.get("customer_id")]

    customer_types = {}
    if customer_ids:
        custs = (
            supabase.table("customers")
            .select("id, type")
            .in_("id", customer_ids)
            .execute()
            .data
        )
        customer_types = {c["id"]: c["type"] for c in custs}

    proof_order_ids = set()
    if order_ids:
        proofs = (
            supabase.table("supplier_order_documents")
            .select("supplier_order_id")
            .eq("document_type", "proof_of_export")
            .in_("supplier_order_id", order_ids)
            .execute()
            .data
        )
        proof_order_ids = {p["supplier_order_id"] for p in proofs}

    result = []
    for order in orders:
        oid = order["id"]
        lines = [line for line in all_lines if line["supplier_order_id"] == oid]
        invs = [i for i in all_invs if i["supplier_order_id"] == oid]
        inv_ids = {inv["id"] for inv in invs}
        order_vex = [v for v in all_vex if v["supplier_inv_id"] in inv_ids]
        vex_ids = {v["id"] for v in order_vex}
        order_inv_lines = [line for line in all_inv_lines if line["supplier_inv_id"] in inv_ids]
        order_vex_lines = [line for line in all_vex_lines if line["supplier_vex_id"] in vex_ids]
        parts = compute_part_fulfillment(oid, lines, invs, order_inv_lines, order_vex, order_vex_lines)
        summary = summarize_part_fulfillment(parts)

        for inv in invs:
            inv["vex"] = [v for v in all_vex if v["supplier_inv_id"] == inv["id"]]

        result.append({
            **order,
            "client": order.get("client") or "—",
            "customer_type": customer_types.get(order.get("customer_id")),
            "has_proof": order["id"] in proof_order_ids,
            "total_lines": summary["parts_total"],
            "received_lines": summary["parts_complete"],
            "fulfillment": summary["order_status"],
            "invs": invs,
        })

    return {"rows": result, "total": total_count}


@router.get("/orders/by-number/{so_number}")
def get_supplier_order_by_number(so_number: str, user: dict = Depends(get_current_user)):
    resp = supabase.table("supplier_orders").select("*").eq("so_number", so_number).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail=f"{so_number} not found")
    order = resp.data[0]
    oid = order["id"]
    lines = supabase.table("supplier_order_lines").select("*").eq("supplier_order_id", oid).execute().data
    invs = supabase.table("supplier_invs").select("*").eq("supplier_order_id", oid).execute().data
    inv_ids = [inv["id"] for inv in invs]
    all_vex = (
        supabase.table("supplier_vex")
        .select("*")
        .in_("supplier_inv_id", inv_ids)
        .execute()
        .data
    ) if inv_ids else []
    inv_lines = (
        supabase.table("supplier_inv_lines")
        .select("*")
        .in_("supplier_inv_id", inv_ids)
        .execute()
        .data
    ) if inv_ids else []
    vex_ids = [v["id"] for v in all_vex]
    vex_lines = (
        supabase.table("supplier_vex_lines")
        .select("*")
        .in_("supplier_vex_id", vex_ids)
        .execute()
        .data
    ) if vex_ids else []
    parts = compute_part_fulfillment(oid, lines, invs, inv_lines, all_vex, vex_lines)
    summary = summarize_part_fulfillment(parts)

    for inv in invs:
        inv["vex"] = [v for v in all_vex if v["supplier_inv_id"] == inv["id"]]

    customer_type = None
    if order.get("customer_id"):
        cust = supabase.table("customers").select("type").eq("id", order["customer_id"]).execute()
        if cust.data:
            customer_type = cust.data[0]["type"]

    return {
        **order,
        "client": order.get("client") or "—",
        "customer_type": customer_type,
        "total_lines": summary["parts_total"],
        "received_lines": summary["parts_complete"],
        "fulfillment": summary["order_status"],
        "invs": invs,
    }


@router.get("/orders/{so_number}/lines-by-so")
def get_lines_by_so(so_number: str, user: dict = Depends(get_current_user)):
    order = supabase.table("supplier_orders").select("id").eq("so_number", so_number).execute()
    if not order.data:
        raise HTTPException(status_code=404, detail=f"{so_number} not found")
    supplier_order_id = order.data[0]["id"]
    lines = supabase.table("supplier_order_lines").select("*").eq("supplier_order_id", supplier_order_id).execute().data
    invs = supabase.table("supplier_invs").select("*").eq("supplier_order_id", supplier_order_id).execute().data
    inv_ids = [inv["id"] for inv in invs]
    inv_lines = (
        supabase.table("supplier_inv_lines")
        .select("*")
        .in_("supplier_inv_id", inv_ids)
        .execute()
        .data
    ) if inv_ids else []
    vex = (
        supabase.table("supplier_vex")
        .select("*")
        .in_("supplier_inv_id", inv_ids)
        .execute()
        .data
    ) if inv_ids else []
    vex_ids = [v["id"] for v in vex]
    vex_lines = (
        supabase.table("supplier_vex_lines")
        .select("*")
        .in_("supplier_vex_id", vex_ids)
        .execute()
        .data
    ) if vex_ids else []

    line_by_part = {}
    for line in lines:
        if line["part_number"] not in line_by_part:
            line_by_part[line["part_number"]] = line

    parts = compute_part_fulfillment(supplier_order_id, lines, invs, inv_lines, vex, vex_lines)
    result = []
    for part in parts:
        source = line_by_part.get(part["part_number"], {})
        result.append({
            **part,
            "id": source.get("id", part["part_number"]),
            "description": source.get("description"),
            "quantity": part["ordered"],
            "warehouse": source.get("warehouse"),
            "eta_to_ferral": source.get("eta_to_ferral"),
            "po_category": source.get("po_category"),
        })

    return result


@router.post("/attach/po")
async def attach_po(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
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

    pdf_uploaded = True
    try:
        path = f"{parsed['so_number']}/{file.filename}"
        supabase_admin.storage.from_("documents").upload(path, content, {"content-type": "application/pdf", "upsert": "true"})
        url = supabase_admin.storage.from_("documents").get_public_url(path)
        supabase.table("supplier_orders").update({"po_pdf_url": url}).eq("so_number", parsed["so_number"]).execute()
    except Exception as exc:
        pdf_uploaded = False
        logger.warning("PDF storage upload failed for %s: %s", path, exc)

    return {
        "so_number": parsed["so_number"],
        "po_number": parsed["po_number"],
        "vendor": parsed["vendor"],
        "pdf_uploaded": pdf_uploaded,
    }


@router.post("/attach/ferral-ov")
async def attach_ferral_ov(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
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

    pdf_uploaded = True
    try:
        path = f"{parsed['so_number']}/{file.filename}"
        supabase_admin.storage.from_("documents").upload(path, content, {"content-type": "application/pdf", "upsert": "true"})
        url = supabase_admin.storage.from_("documents").get_public_url(path)
        supabase.table("supplier_orders").update({"ferral_ov_pdf_url": url}).eq("so_number", parsed["so_number"]).execute()
    except Exception as exc:
        pdf_uploaded = False
        logger.warning("PDF storage upload failed for %s: %s", path, exc)

    return {
        "ferral_order_number": parsed["ferral_order_number"],
        "madisa_ov": parsed["madisa_ov"],
        "so_number": parsed["so_number"],
        "parts_count": len(parsed["parts"]),
        "pdf_uploaded": pdf_uploaded,
    }


@router.post("/attach/inv")
async def attach_inv(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
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

    pdf_uploaded = True
    try:
        path = f"{parsed['so_number']}/{file.filename}"
        supabase_admin.storage.from_("documents").upload(path, content, {"content-type": "application/pdf", "upsert": "true"})
        url = supabase_admin.storage.from_("documents").get_public_url(path)
        supabase.table("supplier_invs").update({"inv_pdf_url": url}).eq("id", supplier_inv_id).execute()
    except Exception as exc:
        pdf_uploaded = False
        logger.warning("PDF storage upload failed for %s: %s", path, exc)

    return {
        "so_number": parsed["so_number"],
        "inv_number": parsed["inv_number"],
        "inv_date": parsed["inv_date"],
        "parts_count": len(parsed["parts"]),
        "pdf_uploaded": pdf_uploaded,
    }


@router.post("/orders/{so_number}/inv/{inv_number}/vex")
async def attach_vex(
    so_number: str,
    inv_number: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    from app.parsers.vex_parser import parse_vex_pdf

    inv = (
        supabase.table("supplier_invs")
        .select("id, supplier_order_id")
        .eq("inv_number", inv_number)
        .execute()
    )
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

    order = (
        supabase.table("supplier_orders")
        .select("so_number")
        .eq("id", inv.data[0]["supplier_order_id"])
        .execute()
    )
    if order.data[0]["so_number"] != so_number:
        raise HTTPException(status_code=422, detail=f"{inv_number} no pertenece a {so_number}")

    inv_lines = (
        supabase.table("supplier_inv_lines")
        .select("part_number, quantity")
        .eq("supplier_inv_id", supplier_inv_id)
        .execute()
        .data
    )
    inv_qty = {l["part_number"]: l["quantity"] for l in inv_lines}

    prev_vex = (
        supabase.table("supplier_vex")
        .select("id")
        .eq("supplier_inv_id", supplier_inv_id)
        .execute()
        .data
    )
    prev_vex_ids = [v["id"] for v in prev_vex]
    received = {}
    if prev_vex_ids:
        prev_lines = (
            supabase.table("supplier_vex_lines")
            .select("part_number, quantity")
            .in_("supplier_vex_id", prev_vex_ids)
            .execute()
            .data
        )
        for l in prev_lines:
            received[l["part_number"]] = received.get(l["part_number"], 0) + l["quantity"]

    overflow = []
    for p in parsed["parts"]:
        pn = p["part_number"]
        pedido = inv_qty.get(pn)
        if pedido is None:
            overflow.append(f"{pn} no está en {inv_number}")
            continue
        total = received.get(pn, 0) + p["quantity"]
        if total > pedido:
            overflow.append(
                f"{pn}: {inv_number} factura {pedido}, ya recibido {received.get(pn, 0)}, "
                f"este VEX suma {p['quantity']} (total {total})"
            )
    if overflow:
        raise HTTPException(
            status_code=422,
            detail="El VEX excede lo facturado en el INV. " + "; ".join(overflow),
        )

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

    pdf_uploaded = True
    path = file.filename
    try:
        inv_data = supabase.table("supplier_invs").select("supplier_order_id").eq("id", supplier_inv_id).execute()
        order_data = supabase.table("supplier_orders").select("so_number").eq("id", inv_data.data[0]["supplier_order_id"]).execute()
        so_for_path = order_data.data[0]["so_number"]
        path = f"{so_for_path}/{file.filename}"
        supabase_admin.storage.from_("documents").upload(path, content, {"content-type": "application/pdf", "upsert": "true"})
        url = supabase_admin.storage.from_("documents").get_public_url(path)
        supabase.table("supplier_vex").update({"vex_pdf_url": url}).eq("id", supplier_vex_id).execute()
    except Exception as exc:
        pdf_uploaded = False
        logger.warning("PDF storage upload failed for %s: %s", path, exc)

    return {
        "vex_number": parsed["vex_number"],
        "vex_date": parsed["vex_date"],
        "parts_count": len(parsed["parts"]),
        "pdf_uploaded": pdf_uploaded,
    }


@router.delete("/vex/{vex_id}")
def delete_vex(vex_id: str, user: dict = Depends(get_current_user)):
    vex = supabase.table("supplier_vex").select("id, vex_pdf_url").eq("id", vex_id).execute()
    if not vex.data:
        raise HTTPException(status_code=404, detail="VEX not found")

    supabase.table("supplier_vex_lines").delete().eq("supplier_vex_id", vex_id).execute()
    supabase.table("supplier_vex").delete().eq("id", vex_id).execute()
    _delete_storage_file(vex.data[0].get("vex_pdf_url"))
    return {"deleted": vex_id}


@router.delete("/inv/{inv_id}")
def delete_inv(inv_id: str, user: dict = Depends(get_current_user)):
    inv = supabase.table("supplier_invs").select("id, inv_pdf_url").eq("id", inv_id).execute()
    if not inv.data:
        raise HTTPException(status_code=404, detail="INV not found")

    vex_rows = supabase.table("supplier_vex").select("id, vex_pdf_url").eq("supplier_inv_id", inv_id).execute().data or []
    vex_ids = [v["id"] for v in vex_rows]
    if vex_ids:
        supabase.table("supplier_vex_lines").delete().in_("supplier_vex_id", vex_ids).execute()
        supabase.table("supplier_vex").delete().eq("supplier_inv_id", inv_id).execute()

    supabase.table("supplier_inv_lines").delete().eq("supplier_inv_id", inv_id).execute()
    supabase.table("supplier_invs").delete().eq("id", inv_id).execute()

    for v in vex_rows:
        _delete_storage_file(v.get("vex_pdf_url"))
    _delete_storage_file(inv.data[0].get("inv_pdf_url"))

    return {"deleted": inv_id, "vex_deleted": len(vex_ids)}


@router.post("/sync/madisa")
async def sync_madisa(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
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
        except (ValueError, TypeError):
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


@router.post("/orders/{so_number}/proof-of-export")
async def upload_proof_of_export(
    so_number: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    order = supabase.table("supplier_orders").select("id").eq("so_number", so_number).execute()
    if not order.data:
        raise HTTPException(status_code=404, detail=f"{so_number} not found")
    supplier_order_id = order.data[0]["id"]
    content = await file.read()
    path = f"{so_number}/proof_of_export_{file.filename}"
    supabase_admin.storage.from_("documents").upload(
        path,
        content,
        {"content-type": "application/pdf", "upsert": "true"},
    )
    url = supabase_admin.storage.from_("documents").get_public_url(path)
    result = supabase.table("supplier_order_documents").insert({
        "supplier_order_id": supplier_order_id,
        "document_type": "proof_of_export",
        "file_url": url,
        "file_name": file.filename,
    }).execute()
    return result.data[0]


@router.post("/orders/{so_number}/shipping-label")
async def upload_shipping_label(
    so_number: str,
    files: list[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
):
    order = supabase.table("supplier_orders").select("id").eq("so_number", so_number).execute()
    if not order.data:
        raise HTTPException(status_code=404, detail=f"{so_number} not found")
    supplier_order_id = order.data[0]["id"]

    inserted = []
    for file in files:
        content = await file.read()
        path = f"{so_number}/shipping_label_{file.filename}"
        supabase_admin.storage.from_("documents").upload(
            path,
            content,
            {"content-type": "application/pdf", "upsert": "true"},
        )
        url = supabase_admin.storage.from_("documents").get_public_url(path)
        result = supabase.table("supplier_order_documents").insert({
            "supplier_order_id": supplier_order_id,
            "document_type": "shipping_label",
            "file_url": url,
            "file_name": file.filename,
        }).execute()
        inserted.append(result.data[0])

    return inserted


@router.get("/orders/{so_number}/documents")
def get_order_documents(so_number: str, user: dict = Depends(get_current_user)):
    order = supabase.table("supplier_orders").select("id").eq("so_number", so_number).execute()
    if not order.data:
        raise HTTPException(status_code=404, detail=f"{so_number} not found")
    supplier_order_id = order.data[0]["id"]
    docs = (
        supabase.table("supplier_order_documents")
        .select("*")
        .eq("supplier_order_id", supplier_order_id)
        .execute()
        .data
    )
    return docs


@router.delete("/documents/{doc_id}")
def delete_order_document(doc_id: str, user: dict = Depends(get_current_user)):
    supabase.table("supplier_order_documents").delete().eq("id", doc_id).execute()
    return {"deleted": True}
