from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.database import supabase_admin as supabase
from app.routers.supplier_tracking import compute_part_fulfillment

router = APIRouter(prefix="/receiving-history", tags=["Receiving History"])

@router.get("/orders")
def get_orders_with_vex(
    page: int = 1,
    limit: int = 25,
    search: str = "",
    filter_so: str = "",
    filter_client: str = "",
    sort_by: str = "newest",
    user: dict = Depends(get_current_user),
):
    supplier_orders = supabase.table("supplier_orders").select("*").execute().data
    supplier_invs = supabase.table("supplier_invs").select("*").execute().data
    supplier_vex = supabase.table("supplier_vex").select("*").execute().data

    vex_by_inv = {}
    for v in supplier_vex:
        vex_by_inv.setdefault(v["supplier_inv_id"], []).append(v)

    results = []
    for so in supplier_orders:
        so_invs = [i for i in supplier_invs if i["supplier_order_id"] == so["id"]]
        has_vex = any(i["id"] in vex_by_inv for i in so_invs)
        if not has_vex:
            continue
        results.append({
            "so_number": so["so_number"],
            "po_number": so.get("po_number"),
            "client": so.get("client"),
            "order_date": so.get("order_date"),
        })

    q = search.strip().lower()
    if q:
        searched = [
            o for o in results
            if q in (o["so_number"] or "").lower()
            or q in (o.get("client") or "").lower()
            or q in (o.get("po_number") or "").lower()
        ]
    else:
        searched = results

    so_options = sorted({o["so_number"] for o in searched if o.get("so_number")})
    client_options = sorted({o["client"] for o in searched if o.get("client")})

    filtered = searched
    if filter_so:
        filtered = [o for o in filtered if o["so_number"] == filter_so]
    if filter_client:
        filtered = [o for o in filtered if (o.get("client") or "") == filter_client]

    if sort_by == "oldest":
        filtered = sorted(filtered, key=lambda o: o.get("order_date") or "")
    elif sort_by == "az":
        filtered = sorted(filtered, key=lambda o: (o.get("client") or "").lower())
    else:
        filtered = sorted(filtered, key=lambda o: o.get("order_date") or "", reverse=True)

    total = len(filtered)
    start = (page - 1) * limit
    paginated = filtered[start:start + limit]
    order_id_by_so = {o["so_number"]: o["id"] for o in supplier_orders}
    order_ids_page = [order_id_by_so[o["so_number"]] for o in paginated if o.get("so_number") in order_id_by_so]
    if order_ids_page:
        order_lines_page = (
            supabase.table("supplier_order_lines")
            .select("*")
            .in_("supplier_order_id", order_ids_page)
            .execute()
            .data
        )
        invs_page = [inv for inv in supplier_invs if inv["supplier_order_id"] in order_ids_page]
        inv_ids_page = [inv["id"] for inv in invs_page]
        inv_lines_page = (
            supabase.table("supplier_inv_lines")
            .select("*")
            .in_("supplier_inv_id", inv_ids_page)
            .execute()
            .data
        ) if inv_ids_page else []
        vex_page = [v for v in supplier_vex if v["supplier_inv_id"] in inv_ids_page]
        vex_ids_page = [v["id"] for v in vex_page]
        vex_lines_page = (
            supabase.table("supplier_vex_lines")
            .select("*")
            .in_("supplier_vex_id", vex_ids_page)
            .execute()
            .data
        ) if vex_ids_page else []

        for row in paginated:
            order_id = order_id_by_so.get(row["so_number"])
            if not order_id:
                continue
            order_lines = [line for line in order_lines_page if line["supplier_order_id"] == order_id]
            invs = [inv for inv in invs_page if inv["supplier_order_id"] == order_id]
            inv_ids = {inv["id"] for inv in invs}
            inv_lines = [line for line in inv_lines_page if line["supplier_inv_id"] in inv_ids]
            vex = [v for v in vex_page if v["supplier_inv_id"] in inv_ids]
            vex_ids = {v["id"] for v in vex}
            vex_lines = [line for line in vex_lines_page if line["supplier_vex_id"] in vex_ids]
            parts = compute_part_fulfillment(order_id, order_lines, invs, inv_lines, vex, vex_lines)
            row["status"] = "complete" if parts and all(part["status"] == "complete" for part in parts) else "partial"

    return { "rows": paginated, "total": total, "so_options": so_options, "client_options": client_options }

@router.get("/orders/{so_number}")
def get_order_detail(so_number: str, user: dict = Depends(get_current_user)):
    order = supabase.table("supplier_orders").select("*").eq("so_number", so_number).execute()
    if not order.data:
        from fastapi import HTTPException
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

    inv_by_id = {inv["id"]: inv for inv in invs}
    vex_by_id = {v["id"]: v for v in vex}
    inv_lines_by_part = {}
    for line in inv_lines:
        inv_lines_by_part.setdefault(line["part_number"], []).append(line)

    vex_lines_by_part = {}
    for line in vex_lines:
        vex_lines_by_part.setdefault(line["part_number"], []).append(line)

    line_by_part = {}
    for line in lines:
        if line["part_number"] not in line_by_part:
            line_by_part[line["part_number"]] = line

    parts = compute_part_fulfillment(supplier_order_id, lines, invs, inv_lines, vex, vex_lines)

    part_rows = []
    for part in parts:
        pn = part["part_number"]
        pn_with_suffix = pn + "-N"

        inv_matches = []
        for inv_line in inv_lines_by_part.get(pn, []):
            inv = inv_by_id.get(inv_line["supplier_inv_id"])
            if inv and inv["inv_number"] not in inv_matches:
                inv_matches.append(inv["inv_number"])

        vex_matches = []
        latest_date = None
        for vex_line in vex_lines_by_part.get(pn, []):
            v = vex_by_id.get(vex_line["supplier_vex_id"])
            if not v:
                continue
            if v["vex_number"] not in vex_matches:
                vex_matches.append(v["vex_number"])
            created = v.get("created_at", "")
            if created:
                if latest_date is None or created > latest_date:
                    latest_date = created

        source = line_by_part.get(pn, {})

        part_rows.append({
            "part_number": pn_with_suffix,
            "description": source.get("description", "—"),
            "qty": part["ordered"],
            "qty_received": part["received"],
            "qty_pending": part["pending_to_receive"],
            "pending_reason": part["pending_reason"],
            "invs": inv_matches,
            "vexs": vex_matches,
            "date_of_receiving": latest_date[:10] if latest_date else None,
        })

    return {
        "so_number": so_number,
        "client": order.data[0].get("client"),
        "po_number": order.data[0].get("po_number"),
        "order_date": order.data[0].get("order_date"),
        "parts": part_rows,
    }
