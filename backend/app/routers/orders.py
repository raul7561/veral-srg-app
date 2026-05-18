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
    sales_orders = supabase.table("sales_orders").select("*").order("so_date", desc=True).execute().data
    all_invoices = supabase.table("invoices").select("*").execute().data
    all_parts = supabase.table("parts").select("*").execute().data
    all_logs = supabase.table("receiving_log").select("*").execute().data
    all_vex = supabase.table("vex_numbers").select("*").execute().data

    result = []

    for so in sales_orders:
        so_date = date.fromisoformat(so["so_date"]) if so.get("so_date") else None
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

        invs = [i for i in all_invoices if i["so_number"] == so["so_number"]]
        inv_list = []

        for inv in invs:
            parts = [p for p in all_parts if p["invoice_id"] == inv["id"]]
            logs = [r for r in all_logs if r["invoice_id"] == inv["id"]]
            vex_list = [v for v in all_vex if v["invoice_id"] == inv["id"]]

            total_pns = len(parts)
            received_pns = sum(
                1 for p in parts
                if sum(r["quantity_received"] for r in logs if r["part_number"] == p["part_number"]) >= p["quantity"]
            )

            part_list = []
            for p in parts:
                qty_received = sum(r["quantity_received"] for r in logs if r["part_number"] == p["part_number"])
                part_list.append({
                    "part_number": p["part_number"],
                    "description": p["description"],
                    "quantity": p["quantity"],
                    "quantity_received": qty_received,
                    "complete": qty_received >= p["quantity"]
                })

            inv_list.append({
                "id": inv["id"],
                "inv_number": inv["inv_number"],
                "invoice_date": inv.get("invoice_date"),
                "dispatch_status": inv.get("dispatch_status", "pending"),
                "total_pns": total_pns,
                "received_pns": received_pns,
                "vex": [v["vex_number"] for v in vex_list],
                "parts": part_list
            })

        result.append({
            "so_number": so["so_number"],
            "so_date": so.get("so_date"),
            "client": so.get("client"),
            "ship_to": so.get("ship_to"),
            "business_days": business_days,
            "lag_status": lag_status,
            "invoices": inv_list
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