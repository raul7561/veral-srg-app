import streamlit as st
from supabase import create_client
from dotenv import load_dotenv
import os
import pdfplumber
import re

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

st.set_page_config(page_title="SRG Operations", layout="wide")

# Sidebar navigation
st.sidebar.title("SRG Operations")
section = st.sidebar.radio("", [
    "Invoices",
    "Receiving",
    "Orders",
    "Pending from Supplier",
    "Ready to Prepare",
    "Shipment Movement"
])

# Sections
if section == "Invoices":
    st.title("Invoices")

    if "processed_files" not in st.session_state:
        st.session_state.processed_files = set()

    uploaded_files = st.file_uploader("Upload INV PDF", type="pdf", accept_multiple_files=True)

    for uploaded_file in (uploaded_files or []):
        if uploaded_file.name in st.session_state.processed_files:
            continue

        with pdfplumber.open(uploaded_file) as pdf:
            page = pdf.pages[0]
            text = page.extract_text()
            words = page.extract_words()
            page_mid = page.width / 2

        inv_number = re.search(r"INV-\d+", text)
        so_number = re.search(r"SO-\d+", text)
        date = re.search(r"\d{1,2}/\d{1,2}/\d{4}", text)

        consignee_words = []
        capture = False
        for w in words:
            if w["text"] == "Consignee":
                capture = True
                continue
            if capture and w["text"] in ["S.O.", "Item"]:
                break
            if capture and float(w["x0"]) < page_mid:
                consignee_words.append(w["text"])

        parts = []
        for line in text.split("\n"):
            match = re.match(r"^(\S+-N)\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$", line)
            if match:
                parts.append({
                    "part_number": match.group(1),
                    "quantity": int(match.group(2)),
                    "description": match.group(3).strip(),
                    "unit_price": match.group(4),
                    "total": match.group(5)
                })

        inv = inv_number.group() if inv_number else "NOT FOUND"
        so = so_number.group() if so_number else "NOT FOUND"
        date_val = date.group() if date else "NOT FOUND"
        client = " ".join(consignee_words[:4]) if consignee_words else "NOT FOUND"

        existing = supabase.table("invoices").select("id").eq("inv_number", inv).execute()

        if existing.data:
            st.warning(f"{inv} already exists — skipped.")
        else:
            try:
                from datetime import datetime
                date_parsed = datetime.strptime(date_val, "%m/%d/%Y").strftime("%Y-%m-%d")
                inv_record = {
                    "inv_number": inv,
                    "so_number": so,
                    "client": client,
                    "invoice_date": date_parsed,
                }
                result = supabase.table("invoices").insert(inv_record).execute()
                inv_id = result.data[0]["id"]
                for p in parts:
                    supabase.table("parts").insert({
                        "invoice_id": inv_id,
                        "part_number": p["part_number"],
                        "description": p["description"],
                        "quantity": p["quantity"]
                    }).execute()
                st.success(f"Saved {inv} — {so} — {client} — {len(parts)} parts.")
            except Exception as e:
                st.error(f"Error saving {inv}: {e}")

        st.session_state.processed_files.add(uploaded_file.name)

    st.divider()

elif section == "Receiving":
    st.title("Receiving")

    search = st.text_input("Search by Part Number", placeholder="e.g. 2454324 or 2454324-N")

    if search:
        normalized = search.strip().upper()
        if not normalized.endswith("-N"):
            normalized += "-N"

        parts_found = supabase.table("parts").select("*").eq("part_number", normalized).execute().data

        if not parts_found:
            st.warning(f"No records found for {normalized}")
        else:
            pending = []
            for part in parts_found:
                inv_data = supabase.table("invoices").select("*").eq("id", part["invoice_id"]).execute().data
                inv_row = inv_data[0] if inv_data else {}

                vex_list = supabase.table("vex_numbers").select("vex_number").eq("invoice_id", part["invoice_id"]).execute().data
                vex_tags = " ".join([v["vex_number"] for v in vex_list]) if vex_list else "No VEX"

                received_log = supabase.table("receiving_log").select("quantity_received").eq("invoice_id", part["invoice_id"]).eq("part_number", normalized).execute().data
                qty_received = sum([r["quantity_received"] for r in received_log]) if received_log else 0
                qty_ordered = part["quantity"] or 0

                if qty_received >= qty_ordered:
                    continue

                pending.append((part, inv_row, vex_tags, qty_ordered, qty_received))

            if not pending:
                st.success(f"✓ {normalized} fully received across all invoices.")
            else:
                for part, inv_row, vex_tags, qty_ordered, qty_received in pending:
                    with st.container(border=True):
                        col1, col2, col3 = st.columns([5, 2, 2])
                        with col1:
                            st.write(f"**{inv_row.get('so_number','—')}** — {inv_row.get('client','—')} — {inv_row.get('inv_number','—')} — {vex_tags} — {normalized}")
                        with col2:
                            st.write(f"Ordered: {qty_ordered} | Rcvd: {qty_received}")
                        with col3:
                            receive_type = st.radio("", ["Complete", "Partial"], key=f"type_{part['id']}", horizontal=True)

                        col4, col5 = st.columns([3, 1])
                        with col4:
                            qty_input = st.number_input("Qty", min_value=0, max_value=qty_ordered, value=0, key=f"qty_{part['id']}")
                        with col5:
                            if st.button("Log", key=f"log_{part['id']}"):
                                try:
                                    if receive_type == "Complete":
                                        final_qty = qty_ordered - qty_received
                                    else:
                                        if qty_input == 0:
                                            st.warning("Enter a quantity for partial receipt.")
                                            st.stop()
                                        final_qty = qty_input
                                    supabase.table("receiving_log").insert({
                                        "invoice_id": part["invoice_id"],
                                        "part_number": normalized,
                                        "quantity_received": final_qty,
                                        "receive_type": receive_type.lower()
                                    }).execute()
                                    st.success(f"✓ {final_qty} units of {normalized} logged successfully.")
                                    st.rerun()
                                except Exception as e:
                                    st.error(f"Error: {e}")

elif section == "Orders":
    st.title("Orders")
    st.info("View SOs with progress and lag alerts.")

elif section == "Pending from Supplier":
    st.title("Pending from Supplier")
    st.info("Parts not yet received, ordered by wait time.")

elif section == "Ready to Prepare":
    st.title("Ready to Prepare")
    st.info("SOs ready for dispatch preparation.")

elif section == "Shipment Movement":
    st.title("Shipment Movement")
    st.info("Track shipments and log truck arrivals.")