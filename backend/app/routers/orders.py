from fastapi import APIRouter, UploadFile, File, HTTPException
from app.database import supabase
import numpy as np
import pdfplumber
import re
import io
from datetime import date, datetime

router = APIRouter(prefix="/orders", tags=["orders"])

@router.get("")
def get_orders():
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


@router.post("/upload")
async def upload_so(file: UploadFile = File(...)):
    content = await file.read()

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        page = pdf.pages[0]
        text = page.extract_text()
        words = page.extract_words()
        page_mid = page.width / 2

    so_number = re.search(r"SO-\d+", text)
    so_date = re.search(r"\d{1,2}/\d{1,2}/\d{4}", text)

    capture = False
    client_words = []
    ship_words = []
    skip = {"Ship", "To"}
    for w in words:
        if w["text"] == "Address":
            capture = True
            continue
        if capture and w["text"] in ["Customer", "Item", "Orders"]:
            break
        if capture and w["text"] in skip:
            continue
        if capture:
            if float(w["x0"]) < page_mid:
                client_words.append(w["text"])
            else:
                ship_words.append(w["text"])

    parts = []
    for line in text.split("\n"):
        match = re.match(r"^(\S+-N)\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$", line)
        if match:
            parts.append({
                "part_number": match.group(1),
                "quantity": int(match.group(2)),
                "description": match.group(3).strip(),
                "rate": float(match.group(4).replace(",", "")),
            })

    so = so_number.group() if so_number else None
    date_val = so_date.group() if so_date else None
    client = " ".join(client_words[:4]) if client_words else "NOT FOUND"
    ship_to = " ".join(ship_words[:3]) if ship_words else "NOT FOUND"

    if not so:
        raise HTTPException(status_code=400, detail="SO number not found in PDF")

    existing = supabase.table("sales_orders").select("id").eq("so_number", so).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail=f"{so} already exists")

    date_parsed = datetime.strptime(date_val, "%m/%d/%Y").strftime("%Y-%m-%d") if date_val else None

    result = supabase.table("sales_orders").insert({
        "so_number": so,
        "so_date": date_parsed,
        "client": client,
        "ship_to": ship_to,
    }).execute()

    so_id = result.data[0]["id"]

    for p in parts:
        supabase.table("so_parts").insert({
            "so_id": so_id,
            "part_number": p["part_number"],
            "description": p["description"],
            "quantity": p["quantity"],
            "rate": p["rate"],
        }).execute()

    return {
        "so_number": so,
        "client": client,
        "parts_count": len(parts)
    }


@router.patch("/{so_number}")
def update_order(so_number: str, data: dict):
    allowed = {"client", "ship_to", "so_date"}
    update = {k: v for k, v in data.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    supabase.table("sales_orders").update(update).eq("so_number", so_number).execute()
    return {"updated": so_number}
