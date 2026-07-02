from fastapi import APIRouter, HTTPException, Depends
from app.database import supabase_admin as supabase
from datetime import datetime, timezone
from app.auth import get_current_user
from app.routers.supplier_tracking import compute_part_fulfillment

router = APIRouter(prefix="/ready-to-dispatch", tags=["Ready to Dispatch"])


def _group_by(rows, key):
    grouped = {}
    for row in rows:
        grouped.setdefault(row[key], []).append(row)
    return grouped


def _is_inv_complete(inv_lines, vex_lines):
    if not inv_lines:
        return False
    if not vex_lines:
        return False

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
def get_ready_orders(user: dict = Depends(get_current_user)):
    supplier_orders = supabase.table("supplier_orders").select("*").execute().data
    supplier_invs = supabase.table("supplier_invs").select("*").execute().data
    order_ids_with_invs = sorted({inv["supplier_order_id"] for inv in supplier_invs})
    inv_ids = [inv["id"] for inv in supplier_invs]

    supplier_order_lines = (
        supabase.table("supplier_order_lines")
        .select("*")
        .in_("supplier_order_id", order_ids_with_invs)
        .execute()
        .data
    ) if order_ids_with_invs else []
    supplier_inv_lines = (
        supabase.table("supplier_inv_lines")
        .select("*")
        .in_("supplier_inv_id", inv_ids)
        .execute()
        .data
    ) if inv_ids else []
    supplier_vex = (
        supabase.table("supplier_vex")
        .select("*")
        .in_("supplier_inv_id", inv_ids)
        .execute()
        .data
    ) if inv_ids else []
    vex_ids = [v["id"] for v in supplier_vex]
    supplier_vex_lines = (
        supabase.table("supplier_vex_lines")
        .select("*")
        .in_("supplier_vex_id", vex_ids)
        .execute()
        .data
    ) if vex_ids else []
    shipping_docs = (
        supabase.table("supplier_order_documents")
        .select("*")
        .eq("document_type", "shipping_label")
        .in_("supplier_order_id", order_ids_with_invs)
        .execute()
        .data
    ) if order_ids_with_invs else []

    invs_by_order = _group_by(supplier_invs, "supplier_order_id")
    order_lines_by_order = _group_by(supplier_order_lines, "supplier_order_id")
    inv_lines_by_inv = _group_by(supplier_inv_lines, "supplier_inv_id")
    vex_by_inv = _group_by(supplier_vex, "supplier_inv_id")
    vex_lines_by_vex = _group_by(supplier_vex_lines, "supplier_vex_id")
    shipping_docs_by_order = _group_by(shipping_docs, "supplier_order_id")

    results = []
    for so in supplier_orders:
        so_invs = invs_by_order.get(so["id"], [])
        if not so_invs:
            continue

        inv_statuses = []
        for inv in so_invs:
            inv_vex = vex_by_inv.get(inv["id"], [])
            inv_vex_ids = {v["id"] for v in inv_vex}
            inv_vex_lines = [
                line
                for vex_id in inv_vex_ids
                for line in vex_lines_by_vex.get(vex_id, [])
            ]
            complete = _is_inv_complete(inv_lines_by_inv.get(inv["id"], []), inv_vex_lines)
            inv_statuses.append({
                "inv_id": inv["id"],
                "inv_number": inv["inv_number"],
                "inv_date": inv.get("inv_date"),
                "dispatch_status": inv.get("dispatch_status", "pending"),
                "dispatched_at": inv.get("dispatched_at"),
                "complete": complete,
                "vexs": sorted(v["vex_number"] for v in inv_vex if v.get("vex_number")),
            })

        any_complete = any(s["complete"] for s in inv_statuses)
        if not any_complete:
            continue

        all_complete = all(s["complete"] for s in inv_statuses)
        so_dispatch_status = so.get("dispatch_status", "pending")
        so_inv_ids = {inv["id"] for inv in so_invs}
        so_vex = [
            v
            for inv_id in so_inv_ids
            for v in vex_by_inv.get(inv_id, [])
        ]
        so_vex_ids = {v["id"] for v in so_vex}
        so_inv_lines = [
            line
            for inv_id in so_inv_ids
            for line in inv_lines_by_inv.get(inv_id, [])
        ]
        so_vex_lines = [
            line
            for vex_id in so_vex_ids
            for line in vex_lines_by_vex.get(vex_id, [])
        ]
        parts = compute_part_fulfillment(
            so["id"],
            order_lines_by_order.get(so["id"], []),
            so_invs,
            so_inv_lines,
            so_vex,
            so_vex_lines,
        )
        order_full = bool(parts) and all(part["status"] == "complete" for part in parts)

        results.append({
            "so_number": so["so_number"],
            "po_number": so.get("po_number"),
            "client": so.get("client", "—"),
            "order_date": so.get("order_date"),
            "dispatch_status": so_dispatch_status,
            "dispatched_at": so.get("dispatched_at"),
            "all_complete": all_complete,
            "order_full": order_full,
            "has_shipping_label": bool(shipping_docs_by_order.get(so["id"])),
            "invs": inv_statuses,
        })

    return results

@router.patch("/inv/{inv_id}/ready")
def mark_ready(inv_id: str, user: dict = Depends(get_current_user)):
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
def dispatch_inv(inv_id: str, user: dict = Depends(get_current_user)):
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
def undispatch_inv(inv_id: str, user: dict = Depends(get_current_user)):
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
def mark_so_ready(so_number: str, user: dict = Depends(get_current_user)):
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
def dispatch_so(so_number: str, user: dict = Depends(get_current_user)):
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
