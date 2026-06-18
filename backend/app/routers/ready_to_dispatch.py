from fastapi import APIRouter, HTTPException
from app.database import supabase_admin as supabase
from datetime import datetime, timezone

router = APIRouter(prefix="/ready-to-dispatch", tags=["Ready to Dispatch"])


def get_inv_completion(supplier_inv_id: str) -> bool:
    inv_lines = supabase.table("supplier_inv_lines").select("part_number, quantity").eq("supplier_inv_id", supplier_inv_id).execute().data
    if not inv_lines:
        return False

    vex_list = supabase.table("supplier_vex").select("id").eq("supplier_inv_id", supplier_inv_id).execute().data
    if not vex_list:
        return False

    vex_ids = [v["id"] for v in vex_list]
    vex_lines = []
    for vex_id in vex_ids:
        lines = supabase.table("supplier_vex_lines").select("part_number, quantity").eq("supplier_vex_id", vex_id).execute().data
        vex_lines.extend(lines)

    vex_totals = {}
    for line in vex_lines:
        pn = line["part_number"]
        vex_totals[pn] = vex_totals.get(pn, 0) + line["quantity"]

    for line in inv_lines:
        pn = line["part_number"]
        if vex_totals.get(pn, 0) < line["quantity"]:
            return False

    return True


@router.get("/orders")
def get_ready_orders():
    supplier_orders = supabase.table("supplier_orders").select("*").execute().data
    supplier_invs = supabase.table("supplier_invs").select("*").execute().data

    results = []
    for so in supplier_orders:
        so_invs = [i for i in supplier_invs if i["supplier_order_id"] == so["id"]]
        if not so_invs:
            continue

        inv_statuses = []
        for inv in so_invs:
            complete = get_inv_completion(inv["id"])
            inv_statuses.append({
                "inv_id": inv["id"],
                "inv_number": inv["inv_number"],
                "inv_date": inv.get("inv_date"),
                "dispatch_status": inv.get("dispatch_status", "pending"),
                "dispatched_at": inv.get("dispatched_at"),
                "complete": complete,
            })

        any_complete = any(s["complete"] for s in inv_statuses)
        if not any_complete:
            continue

        all_complete = all(s["complete"] for s in inv_statuses)
        so_dispatch_status = so.get("dispatch_status", "pending")

        results.append({
            "so_number": so["so_number"],
            "po_number": so.get("po_number"),
            "client": so.get("client", "—"),
            "order_date": so.get("order_date"),
            "dispatch_status": so_dispatch_status,
            "dispatched_at": so.get("dispatched_at"),
            "all_complete": all_complete,
            "invs": inv_statuses,
        })

    return results

@router.patch("/inv/{inv_id}/ready")
def mark_ready(inv_id: str):
    inv = supabase.table("supplier_invs").select("*").eq("id", inv_id).execute()
    if not inv.data:
        raise HTTPException(status_code=404, detail="INV not found")

    now = datetime.now(timezone.utc).isoformat()
    supabase.table("supplier_invs").update({
        "dispatch_status": "ready",
        "dispatched_at": now,
    }).eq("id", inv_id).execute()

    return {"status": "ready"}

@router.patch("/inv/{inv_id}/dispatch")
def dispatch_inv(inv_id: str):
    inv = supabase.table("supplier_invs").select("*").eq("id", inv_id).execute()
    if not inv.data:
        raise HTTPException(status_code=404, detail="INV not found")

    now = datetime.now(timezone.utc).isoformat()
    supabase.table("supplier_invs").update({
        "dispatch_status": "dispatched",
        "dispatched_at": now,
    }).eq("id", inv_id).execute()

    supplier_order_id = inv.data[0]["supplier_order_id"]
    all_invs = supabase.table("supplier_invs").select("*").eq("supplier_order_id", supplier_order_id).execute().data
    all_dispatched = all(i.get("dispatch_status") == "dispatched" for i in all_invs)

    if all_dispatched:
        supabase.table("supplier_orders").update({
            "dispatch_status": "dispatched",
            "dispatched_at": now,
        }).eq("id", supplier_order_id).execute()

    return {"dispatched": True, "so_fully_dispatched": all_dispatched}


@router.patch("/inv/{inv_id}/undispatch")
def undispatch_inv(inv_id: str):
    inv = supabase.table("supplier_invs").select("*").eq("id", inv_id).execute()
    if not inv.data:
        raise HTTPException(status_code=404, detail="INV not found")

    supabase.table("supplier_invs").update({
        "dispatch_status": "pending",
        "dispatched_at": None,
    }).eq("id", inv_id).execute()

    supplier_order_id = inv.data[0]["supplier_order_id"]
    supabase.table("supplier_orders").update({
        "dispatch_status": "pending",
        "dispatched_at": None,
    }).eq("id", supplier_order_id).execute()

    return {"undispatched": True}

@router.patch("/so/{so_number}/ready")
def mark_so_ready(so_number: str):
    order = supabase.table("supplier_orders").select("id").eq("so_number", so_number).execute()
    if not order.data:
        raise HTTPException(status_code=404, detail="SO not found")

    supplier_order_id = order.data[0]["id"]
    invs = supabase.table("supplier_invs").select("id").eq("supplier_order_id", supplier_order_id).execute().data

    now = datetime.now(timezone.utc).isoformat()
    for inv in invs:
        supabase.table("supplier_invs").update({
            "dispatch_status": "ready",
            "dispatched_at": now,
        }).eq("id", inv["id"]).execute()

    return {"status": "ready", "invs_updated": len(invs)}

@router.patch("/so/{so_number}/dispatch")
def dispatch_so(so_number: str):
    order = supabase.table("supplier_orders").select("id").eq("so_number", so_number).execute()
    if not order.data:
        raise HTTPException(status_code=404, detail="SO not found")

    supplier_order_id = order.data[0]["id"]
    invs = supabase.table("supplier_invs").select("id").eq("supplier_order_id", supplier_order_id).execute().data

    now = datetime.now(timezone.utc).isoformat()
    for inv in invs:
        supabase.table("supplier_invs").update({
            "dispatch_status": "dispatched",
            "dispatched_at": now,
        }).eq("id", inv["id"]).execute()

    supabase.table("supplier_orders").update({
        "dispatch_status": "dispatched",
        "dispatched_at": now,
    }).eq("id", supplier_order_id).execute()

    return {"status": "dispatched", "invs_updated": len(invs)}
