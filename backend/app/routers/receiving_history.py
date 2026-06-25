from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.database import supabase_admin as supabase

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
    vex = supabase.table("supplier_vex").select("*").execute().data

    vex_by_inv = {}
    for v in vex:
        vex_by_inv.setdefault(v["supplier_inv_id"], []).append(v)

    part_rows = []
    for line in lines:
        pn = line["part_number"]
        pn_with_suffix = pn + "-N"

        inv_matches = []
        vex_matches = []
        latest_date = None
        qty_received = 0

        for inv in invs:
            inv_vex = vex_by_inv.get(inv["id"], [])
            if inv_vex:
                inv_matches.append(inv["inv_number"])
                for v in inv_vex:
                    vex_matches.append(v["vex_number"])
                    created = v.get("created_at", "")
                    if created:
                        if latest_date is None or created > latest_date:
                            latest_date = created
                qty_received = line["quantity"]

        part_rows.append({
            "part_number": pn_with_suffix,
            "description": line.get("description", "—"),
            "qty": line["quantity"],
            "qty_received": qty_received,
            "qty_pending": line["quantity"] - qty_received,
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
