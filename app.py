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
    st.info("Search by part number to log received items.")

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