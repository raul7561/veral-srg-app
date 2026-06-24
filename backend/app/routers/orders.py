from fastapi import APIRouter, Depends
from app.database import supabase_admin as supabase
import numpy as np
from datetime import date
from app.auth import get_current_user

router = APIRouter(prefix="/orders", tags=["orders"])

@router.get("")
def get_orders(user: dict = Depends(get_current_user)):
    orders = supabase.table("supplier_orders").select("*").order("order_date", desc=True).execute().data
    all_invs = supabase.table("supplier_invs").select("*").execute().data

    result = []

    for so in orders:
        raw_date = so.get("order_date")
        so_date = date.fromisoformat(raw_date) if raw_date else None
        if so_date:
            business_days = int(np.busday_count(so_date, date.today()))
            if business_days >= 20:
                lag_status = "overdue"
            elif business_days >= 15:
                lag_status = "follow_up"
            else:
                lag_status = "on_track"
        else:
            business_days = None
            lag_status = "unknown"

        invs = [i for i in all_invs if i["supplier_order_id"] == so["id"]]
        inv_list = [
            {
                "id": inv["id"],
                "inv_number": inv.get("inv_number"),
                "invoice_date": inv.get("inv_date"),
                "dispatch_status": inv.get("dispatch_status", "pending"),
            }
            for inv in invs
        ]

        result.append({
            "so_number": so.get("so_number"),
            "so_date": raw_date,
            "client": so.get("client"),
            "business_days": business_days,
            "lag_status": lag_status,
            "invoices": inv_list,
        })

    return result
