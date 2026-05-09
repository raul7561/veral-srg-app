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
sections = [
    "Invoices",
    "Receiving",
    "Orders",
    "Pending from Supplier",
    "Ready to Prepare",
    "Shipment Movement"
]

if "section" not in st.query_params:
    st.query_params["section"] = "Invoices"

current = st.query_params.get("section", "Invoices")
if current not in sections:
    current = "Invoices"

section = st.sidebar.radio("", sections, index=sections.index(current))

if section != current:
    st.query_params["section"] = section

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

    # Active invoices
    all_invoices = supabase.table("invoices").select("*").order("created_at", desc=True).execute().data
    all_parts = supabase.table("parts").select("*").execute().data
    all_logs = supabase.table("receiving_log").select("*").execute().data
    all_vex = supabase.table("vex_numbers").select("*").execute().data

    st.divider()

    search_inv = st.text_input("Search Invoice", placeholder="e.g. INV-33883")

    if search_inv:
        search_inv = search_inv.strip().upper()
        if not search_inv.startswith("INV-"):
            search_inv = f"INV-{search_inv}"
        inv_found = next((i for i in all_invoices if i["inv_number"] == search_inv), None)
        if not inv_found:
            st.warning(f"No invoice found for {search_inv}")
        else:
            inv_parts = [p for p in all_parts if p["invoice_id"] == inv_found["id"]]
            inv_logs = [r for r in all_logs if r["invoice_id"] == inv_found["id"]]
            inv_vex = [v for v in all_vex if v["invoice_id"] == inv_found["id"]]
            vex_tags = " ".join(v["vex_number"] for v in inv_vex) if inv_vex else "No VEX"

            total_pns = len(inv_parts)
            received_pns = sum(
                1 for p in inv_parts
                if sum(r["quantity_received"] for r in inv_logs if r["part_number"] == p["part_number"]) >= p["quantity"]
            )

            if received_pns >= total_pns:
                status = "🟢 Complete"
            elif received_pns > 0:
                status = "🟡 Partial"
            else:
                status = "🔴 Pending"

            dispatch = inv_found.get("dispatch_status", "pending")
            dispatch_label = "🚚 Ready to Dispatch" if dispatch == "ready" else "⏳ Not dispatched"

            with st.container(border=True):
                st.markdown(f"**{inv_found['inv_number']}** — {inv_found.get('so_number','—')} — {inv_found.get('client','—')}")
                st.markdown(f"Date: {inv_found.get('invoice_date','—')} — VEX: {vex_tags}")
                st.markdown(f"Parts: {received_pns}/{total_pns} received — {status}")
                st.markdown(f"Dispatch: {dispatch_label}")

    

    active = []
    completed = []
    for inv_row in all_invoices:
        inv_parts = [p for p in all_parts if p["invoice_id"] == inv_row["id"]]
        inv_logs = [r for r in all_logs if r["invoice_id"] == inv_row["id"]]
        all_done = all(
            sum(r["quantity_received"] for r in inv_logs if r["part_number"] == p["part_number"]) >= p["quantity"]
            for p in inv_parts
        ) if inv_parts else False
        if all_done:
            completed.append(inv_row)
        else:
            active.append(inv_row)

    st.markdown("#### Active Invoices")
    if not active:
        st.success("All invoices fully received.")
    else:
        with st.container(border=True):
            for inv_row in active:
                inv_parts = [p for p in all_parts if p["invoice_id"] == inv_row["id"]]
                vex_list = [v for v in all_vex if v["invoice_id"] == inv_row["id"]]
                vex_tags = " ".join(v["vex_number"] for v in vex_list) if vex_list else "No VEX"
                po_status = f"✅ {inv_row['po_number']}" if inv_row.get("po_number") else "🔴 PO missing"

                col1, col2 = st.columns([7, 1])
                with col1:
                    st.markdown(f"**{inv_row['inv_number']}** — {inv_row.get('so_number','—')} — {inv_row.get('client','—')} — {po_status} — {vex_tags} — {len(inv_parts)} parts")
                with col2:
                    with st.popover("+"):
                        vex_input = st.text_input("VEX number", placeholder="1084", key=f"vex_input_{inv_row['id']}")
                        if st.button("Add", key=f"vex_add_{inv_row['id']}"):
                            if vex_input.strip():
                                full_vex = f"VEX-{vex_input.strip().upper().replace('VEX-', '')}"
                                existing_vex = supabase.table("vex_numbers").select("id").eq("invoice_id", inv_row["id"]).eq("vex_number", full_vex).execute()
                                if existing_vex.data:
                                    st.warning("Already added.")
                                else:
                                    supabase.table("vex_numbers").insert({
                                        "invoice_id": inv_row["id"],
                                        "vex_number": full_vex
                                    }).execute()
                                    st.success(f"{full_vex} added.")
                                    st.rerun()

    st.divider()
    st.markdown("#### Completed Invoices")
    if not completed:
        st.info("No completed invoices yet.")
    else:
        with st.container(border=True):
            for inv_row in completed:
                vex_list = [v for v in all_vex if v["invoice_id"] == inv_row["id"]]
                vex_tags = " ".join(v["vex_number"] for v in vex_list) if vex_list else "No VEX"
                st.markdown(f"✅ **{inv_row['inv_number']}** — {inv_row.get('so_number','—')} — {inv_row.get('client','—')} — {vex_tags}")

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

    st.divider()
    st.markdown("#### Receiving History")

    all_logs = supabase.table("receiving_log").select("*").order("received_at", desc=True).execute().data
    all_invoices = supabase.table("invoices").select("*").execute().data
    all_parts = supabase.table("parts").select("*").execute().data

    inv_map = {i["id"]: i for i in all_invoices}

    import pandas as pd

    rows = []
    for log in all_logs:
        inv = inv_map.get(log["invoice_id"], {})
        part = next((p for p in all_parts if p["invoice_id"] == log["invoice_id"] and p["part_number"] == log["part_number"]), {})
        rows.append({
            "Date": log["received_at"][:10] if log["received_at"] else "—",
            "SO": inv.get("so_number", "—"),
            "Client": inv.get("client", "—"),
            "INV": inv.get("inv_number", "—"),
            "Part Number": log["part_number"],
            "Description": part.get("description", "—"),
            "Qty Received": log["quantity_received"],
            "Type": log["receive_type"] or "—",
        })

    if not rows:
        st.info("No receiving records yet.")
    else:
        df = pd.DataFrame(rows)

        col1, col2, col3 = st.columns(3)
        with col1:
            so_options = ["All"] + sorted(df["SO"].unique().tolist())
            so_filter = st.selectbox("Filter by SO", so_options)
        with col2:
            client_options = ["All"] + sorted(df["Client"].unique().tolist())
            client_filter = st.selectbox("Filter by Client", client_options)
        with col3:
            inv_options = ["All"] + sorted(df["INV"].unique().tolist())
            inv_filter = st.selectbox("Filter by INV", inv_options)

        if so_filter != "All":
            df = df[df["SO"] == so_filter]
        if client_filter != "All":
            df = df[df["Client"] == client_filter]
        if inv_filter != "All":
            df = df[df["INV"] == inv_filter]

        st.dataframe(df, use_container_width=True, hide_index=True)

elif section == "Orders":
    st.title("Orders")

    if "processed_so_files" not in st.session_state:
        st.session_state.processed_so_files = set()

    uploaded_so_files = st.file_uploader("Upload SO PDF", type="pdf", accept_multiple_files=True)

    for uploaded_file in (uploaded_so_files or []):
        if uploaded_file.name in st.session_state.processed_so_files:
            continue

        with pdfplumber.open(uploaded_file) as pdf:
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

        so = so_number.group() if so_number else "NOT FOUND"
        date_val = so_date.group() if so_date else "NOT FOUND"
        client = " ".join(client_words[:4]) if client_words else "NOT FOUND"
        ship_to = " ".join(ship_words[:3]) if ship_words else "NOT FOUND"

        existing = supabase.table("sales_orders").select("id").eq("so_number", so).execute()

        if existing.data:
            st.warning(f"{so} already exists — skipped.")
        else:
            try:
                from datetime import datetime
                date_parsed = datetime.strptime(date_val, "%m/%d/%Y").strftime("%Y-%m-%d")
                so_record = {
                    "so_number": so,
                    "so_date": date_parsed,
                    "client": client,
                    "ship_to": ship_to,
                }
                result = supabase.table("sales_orders").insert(so_record).execute()
                so_id = result.data[0]["id"]
                for p in parts:
                    supabase.table("so_parts").insert({
                        "so_id": so_id,
                        "part_number": p["part_number"],
                        "description": p["description"],
                        "quantity": p["quantity"],
                        "rate": p["rate"],
                    }).execute()
                st.success(f"Saved {so} — {client} — {len(parts)} parts.")
            except Exception as e:
                st.error(f"Error saving {so}: {e}")

        st.session_state.processed_so_files.add(uploaded_file.name)

    st.divider()

    # Active SOs
    so_list = supabase.table("sales_orders").select("*").order("so_date", desc=True).execute().data

    if not so_list:
        st.info("No Sales Orders registered yet.")
    else:
        with st.container(border=True):
            for so_row in so_list:
                inv_list = supabase.table("invoices").select("*").eq("so_number", so_row["so_number"]).execute().data

                if not inv_list:
                    st.warning(f"**{so_row['so_number']}** — {so_row['client']} — No INV registered")
                else:
                    from datetime import date
                    import numpy as np

                    so_date = date.fromisoformat(so_row["so_date"]) if so_row["so_date"] else None
                    if so_date:
                        business_days = np.busday_count(so_date, date.today())
                        if business_days >= 20:
                            lag = f"🔴 Overdue ({business_days}d)"
                        elif business_days >= 15:
                            lag = f"🟠 Follow Up ({business_days}d)"
                        else:
                            lag = f"✅ On Track ({business_days}d)"
                    else:
                        lag = "⚠️ No date"

                    with st.expander(f"{so_row['so_number']} — {so_row['client']} — {so_row['so_date']} — {lag}"):
                        for inv in inv_list:
                            parts = supabase.table("parts").select("*").eq("invoice_id", inv["id"]).execute().data
                            logs = supabase.table("receiving_log").select("*").eq("invoice_id", inv["id"]).execute().data

                            total_pns = len(parts)
                            received_pns = sum(1 for p in parts if sum(r["quantity_received"] for r in logs if r["part_number"] == p["part_number"]) >= p["quantity"])
                            pct = int((received_pns / total_pns) * 100) if total_pns > 0 else 0

                            if pct == 0:
                                status = "🔴 Pending"
                            elif pct >= 100:
                                status = "🟢 Complete"
                            else:
                                status = "🟡 Partial"

                            st.markdown(f"**{inv['inv_number']}** — {status} — {received_pns}/{total_pns} parts received")
                            st.progress(pct / 100)

                            for p in parts:
                                p_received = sum(r["quantity_received"] for r in logs if r["part_number"] == p["part_number"])
                                icon = "✓" if p_received >= p["quantity"] else "○"
                                st.markdown(f"&nbsp;&nbsp;{icon} `{p['part_number']}` — {p_received}/{p['quantity']}")

elif section == "Pending from Supplier":
    st.title("Pending from Supplier")

    if "processed_po_files" not in st.session_state:
        st.session_state.processed_po_files = set()

    uploaded_po_files = st.file_uploader("Upload PO PDF", type="pdf", accept_multiple_files=True)

    for uploaded_file in (uploaded_po_files or []):
        if uploaded_file.name in st.session_state.processed_po_files:
            continue

        with pdfplumber.open(uploaded_file) as pdf:
            page = pdf.pages[0]
            text = page.extract_text()
            words = page.extract_words()
            page_mid = page.width / 2

        po_number = re.search(r"PO-\d+", text)
        po_date = re.search(r"\d{1,2}/\d{1,2}/\d{4}", text)
        so_number = re.search(r"SO-\d+", text)

        capture = False
        vendor_words = []
        skip = {"Ship", "To"}
        for w in words:
            if w["text"] == "Vendor":
                capture = True
                continue
            if capture and w["text"] in ["Sales", "Item"]:
                break
            if capture and w["text"] in skip:
                continue
            if capture and float(w["x0"]) < page_mid:
                vendor_words.append(w["text"])

        parts = []
        for line in text.split("\n"):
            match = re.match(r"^(\S+-N)\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s+\d+\s+([\d,]+\.\d{2})$", line)
            if match:
                parts.append({
                    "part_number": match.group(1),
                    "quantity": int(match.group(2)),
                    "description": match.group(3).strip(),
                    "rate": float(match.group(4).replace(",", "")),
                })

        po = po_number.group() if po_number else "NOT FOUND"
        date_val = po_date.group() if po_date else "NOT FOUND"
        so = so_number.group() if so_number else "NOT FOUND"
        vendor = " ".join(vendor_words[:4]) if vendor_words else "NOT FOUND"

        existing = supabase.table("purchase_orders").select("id").eq("po_number", po).execute()

        if existing.data:
            st.warning(f"{po} already exists — skipped.")
        else:
            try:
                from datetime import datetime
                date_parsed = datetime.strptime(date_val, "%m/%d/%Y").strftime("%Y-%m-%d")
                po_record = {
                    "po_number": po,
                    "po_date": date_parsed,
                    "vendor": vendor,
                    "so_number": so,
                }
                result = supabase.table("purchase_orders").insert(po_record).execute()
                po_id = result.data[0]["id"]
                for p in parts:
                    supabase.table("po_parts").insert({
                        "po_id": po_id,
                        "part_number": p["part_number"],
                        "description": p["description"],
                        "quantity": p["quantity"],
                        "rate": p["rate"],
                    }).execute()
                st.success(f"Saved {po} — {so} — {vendor} — {len(parts)} parts.")
            except Exception as e:
                st.error(f"Error saving {po}: {e}")

        st.session_state.processed_po_files.add(uploaded_file.name)

    st.divider()

    # Pending parts table
    from datetime import date, datetime

    all_parts = supabase.table("parts").select("*").execute().data
    all_logs = supabase.table("receiving_log").select("*").execute().data
    all_invoices = supabase.table("invoices").select("*").execute().data
    all_vex = supabase.table("vex_numbers").select("*").execute().data
    all_pos = supabase.table("purchase_orders").select("*").execute().data

    inv_map = {i["id"]: i for i in all_invoices}
    po_map = {p["so_number"]: p for p in all_pos}

    rows = []
    for p in all_parts:
        inv = inv_map.get(p["invoice_id"], {})
        received = sum(r["quantity_received"] for r in all_logs if r["invoice_id"] == p["invoice_id"] and r["part_number"] == p["part_number"])
        if received >= p["quantity"]:
            continue

        vex_list = [v for v in all_vex if v["invoice_id"] == p["invoice_id"]]
        vex_display = ", ".join(v["vex_number"] for v in vex_list) if vex_list else "—"

        po = po_map.get(inv.get("so_number"), {})
        po_display = po.get("po_number", "—") if po else "—"
        vendor = po.get("vendor", "—") if po else "—"

        if vex_list:
            vex_date = min(datetime.fromisoformat(v["created_at"]).date() for v in vex_list)
            days = (date.today() - vex_date).days
            if days >= 21:
                status = "🔴 Overdue"
            elif days >= 14:
                status = "🟠 Follow Up"
            else:
                status = "⚫ On Track"
        else:
            days = "—"
            status = "⚠️ No VEX"

        rows.append({
            "SO": inv.get("so_number", "—"),
            "Client": inv.get("client", "—"),
            "Part Number": p["part_number"],
            "Description": p["description"] or "—",
            "Qty Pending": p["quantity"] - received,
            "PO": po_display,
            "VEX": vex_display,
            "Days": days,
            "Status": status,
        })

    rows.sort(key=lambda x: x["Days"] if isinstance(x["Days"], int) else -1, reverse=True)

    if not rows:
        st.success("No pending parts from supplier.")
    else:
        st.markdown(f"**{len(rows)} parts pending**")
        import pandas as pd
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

elif section == "Ready to Prepare":
    st.title("Ready to Prepare")

    all_invoices = supabase.table("invoices").select("*").execute().data
    all_parts = supabase.table("parts").select("*").execute().data
    all_logs = supabase.table("receiving_log").select("*").execute().data
    all_so = supabase.table("sales_orders").select("*").execute().data

    so_map = {s["so_number"]: s for s in all_so}

    so_groups = {}
    for inv in all_invoices:
        so = inv["so_number"]
        if so not in so_groups:
            so_groups[so] = []
        so_groups[so].append(inv)

    if not so_groups:
        st.info("No invoices registered yet.")
    else:
        selected_invs = []
        dispatched_sos = []

        for so_number, invs in so_groups.items():
            so_data = so_map.get(so_number, {})
            client = so_data.get("client") or invs[0].get("client", "—")

            inv_statuses = []
            for inv in invs:
                parts = [p for p in all_parts if p["invoice_id"] == inv["id"]]
                logs = [r for r in all_logs if r["invoice_id"] == inv["id"]]
                all_complete = all(
                    sum(r["quantity_received"] for r in logs if r["part_number"] == p["part_number"]) >= p["quantity"]
                    for p in parts
                ) if parts else False
                inv_statuses.append((inv, parts, all_complete))

            all_dispatched = all(s[0].get("dispatch_status") == "ready" for s in inv_statuses)

            if all_dispatched:
                dispatched_sos.append((so_number, client, inv_statuses))
                continue

            so_complete = all(s[2] for s in inv_statuses)

            with st.expander(f"{so_number} — {client} — {'✅ All ready' if so_complete else '⏳ Partial'}"):
                if so_complete:
                    select_all = st.checkbox(f"Select all INVs for {so_number}", key=f"all_{so_number}")
                else:
                    select_all = False

                for inv, parts, complete in inv_statuses:
                    if complete:
                        if inv.get("dispatch_status") == "ready":
                            col_inv, col_btn = st.columns([6, 1])
                            with col_inv:
                                st.markdown(f"**{inv['inv_number']}** — {len(parts)} parts — ✅ Ready — 🚚 Ready to Dispatch")
                            with col_btn:
                                if st.button("Unmark", key=f"unmark_{inv['inv_number']}"):
                                    st.session_state[f"confirm_unmark_{inv['inv_number']}"] = True

                            if st.session_state.get(f"confirm_unmark_{inv['inv_number']}"):
                                st.warning(f"Are you sure you want to unmark {inv['inv_number']} as Ready to Dispatch?")
                                c1, c2 = st.columns([1, 1])
                                with c1:
                                    if st.button("✅ Yes, unmark", key=f"yes_unmark_{inv['inv_number']}"):
                                        supabase.table("invoices").update({
                                            "dispatch_status": "pending",
                                            "dispatched_at": None
                                        }).eq("inv_number", inv["inv_number"]).execute()
                                        del st.session_state[f"confirm_unmark_{inv['inv_number']}"]
                                        st.rerun()
                                with c2:
                                    if st.button("Cancel", key=f"cancel_unmark_{inv['inv_number']}"):
                                        del st.session_state[f"confirm_unmark_{inv['inv_number']}"]
                                        st.rerun()
                        else:
                            checked = st.checkbox(
                                f"{inv['inv_number']} — {len(parts)} parts — ✅ Ready",
                                value=select_all,
                                key=f"chk_{inv['inv_number']}"
                            )
                            if checked:
                                selected_invs.append(inv["inv_number"])
                    else:
                        total_pns = len(parts)
                        received_pns = sum(
                            1 for p in parts
                            if sum(r["quantity_received"] for r in all_logs if r["invoice_id"] == inv["id"] and r["part_number"] == p["part_number"]) >= p["quantity"]
                        )
                        st.checkbox(
                            f"{inv['inv_number']} — ⏳ Incomplete ({received_pns}/{total_pns} parts)",
                            value=False,
                            disabled=True,
                            key=f"chk_{inv['inv_number']}"
                        )

        st.divider()
        if st.button("Mark Selected as Ready to Dispatch", type="primary"):
            if not selected_invs:
                st.warning("No INVs selected.")
            else:
                st.session_state.pending_dispatch = selected_invs
                st.rerun()

        if "pending_dispatch" in st.session_state:
            st.warning(f"Confirm marking as Ready to Dispatch: {', '.join(st.session_state.pending_dispatch)}")
            col1, col2 = st.columns([1, 1])
            with col1:
                if st.button("✅ Confirm", type="primary"):
                    from datetime import datetime, timezone
                    now = datetime.now(timezone.utc).isoformat()
                    for inv_number in st.session_state.pending_dispatch:
                        supabase.table("invoices").update({
                            "dispatch_status": "ready",
                            "dispatched_at": now
                        }).eq("inv_number", inv_number).execute()

                    for so_number, invs in so_groups.items():
                        so_invs = supabase.table("invoices").select("dispatch_status").eq("so_number", so_number).execute().data
                        if all(i["dispatch_status"] == "ready" for i in so_invs):
                            supabase.table("sales_orders").update({
                                "so_dispatch_status": "ready",
                                "dispatched_at": now
                            }).eq("so_number", so_number).execute()

                    del st.session_state.pending_dispatch
                    st.success("Marked as Ready to Dispatch.")
                    st.rerun()
            with col2:
                if st.button("Cancel"):
                    del st.session_state.pending_dispatch
                    st.rerun()

        if dispatched_sos:
            st.divider()
            st.markdown("#### Orders Ready to Dispatch")
            for so_number, client, inv_statuses in dispatched_sos:
                so_data_fresh = so_map.get(so_number, {})
                so_dispatched_at = so_data_fresh.get("dispatched_at", "")
                so_date_label = so_dispatched_at[:10] if so_dispatched_at else "—"
                picked_up_at = so_data_fresh.get("picked_up_at", "")
                pickup_label = picked_up_at[:10] if picked_up_at else None

                if pickup_label:
                    pickup_status = f"✅ Picked up: {pickup_label}"
                else:
                    pickup_status = "⏳ Pending pickup"

                with st.expander(f"🚚 {so_number} — {client} — Ready: {so_date_label} — {pickup_status}"):

                    for inv_s, parts_s, _ in inv_statuses:
                        inv_num = inv_s["inv_number"]
                        inv_dispatched = inv_s.get("dispatched_at", "")
                        inv_date = inv_dispatched[:10] if inv_dispatched else "—"
                        col_i, col_ub = st.columns([6, 1])
                        with col_i:
                            st.markdown(f"📄 **{inv_num}** — Ready: {inv_date}")
                        with col_ub:
                            if st.button("Unmark", key=f"unmark_inv_{inv_num}"):
                                st.session_state[f"confirm_unmark_inv_{inv_num}"] = True

                        if st.session_state.get(f"confirm_unmark_inv_{inv_num}"):
                            st.warning(f"Unmark {inv_num} as Ready to Dispatch?")
                            c1, c2 = st.columns([1, 1])
                            with c1:
                                if st.button("✅ Yes", key=f"yes_unmark_inv_{inv_num}"):
                                    supabase.table("invoices").update({
                                        "dispatch_status": "pending",
                                        "dispatched_at": None
                                    }).eq("inv_number", inv_num).execute()
                                    del st.session_state[f"confirm_unmark_inv_{inv_num}"]
                                    st.rerun()
                            with c2:
                                if st.button("Cancel", key=f"cancel_unmark_inv_{inv_num}"):
                                    del st.session_state[f"confirm_unmark_inv_{inv_num}"]
                                    st.rerun()

                    st.divider()

                    if pickup_label:
                        col_p, col_btn = st.columns([6, 1])
                        with col_p:
                            st.markdown(f"✅ Picked up: {pickup_label}")
                        with col_btn:
                            if st.button("Unmark", key=f"unmark_pickup_{so_number}"):
                                st.session_state[f"confirm_unpickup_{so_number}"] = True

                        if st.session_state.get(f"confirm_unpickup_{so_number}"):
                            st.warning(f"Unmark picked up for {so_number}?")
                            c1, c2 = st.columns([1, 1])
                            with c1:
                                if st.button("✅ Yes, unmark", key=f"yes_unpickup_{so_number}"):
                                    supabase.table("sales_orders").update({
                                        "picked_up_at": None
                                    }).eq("so_number", so_number).execute()
                                    del st.session_state[f"confirm_unpickup_{so_number}"]
                                    st.rerun()
                            with c2:
                                if st.button("Cancel", key=f"cancel_unpickup_{so_number}"):
                                    del st.session_state[f"confirm_unpickup_{so_number}"]
                                    st.rerun()
                    else:
                        if st.button("Mark as Picked Up", key=f"pickup_{so_number}"):
                            st.session_state[f"confirm_pickup_{so_number}"] = True

                        if st.session_state.get(f"confirm_pickup_{so_number}"):
                            st.warning(f"Confirm that {so_number} was picked up?")
                            c1, c2 = st.columns([1, 1])
                            with c1:
                                if st.button("✅ Confirm", key=f"yes_pickup_{so_number}"):
                                    from datetime import datetime, timezone
                                    supabase.table("sales_orders").update({
                                        "picked_up_at": datetime.now(timezone.utc).isoformat()
                                    }).eq("so_number", so_number).execute()
                                    del st.session_state[f"confirm_pickup_{so_number}"]
                                    st.success("Marked as picked up.")
                                    st.rerun()
                            with c2:
                                if st.button("Cancel", key=f"cancel_pickup_{so_number}"):
                                    del st.session_state[f"confirm_pickup_{so_number}"]
                                    st.rerun()

elif section == "Shipment Movement":
    st.title("Shipment Movement")

    with st.container(border=True):
        st.markdown("**New Shipment**")
        st.info("Upload the BOL from Unishipper to create a new shipment. PRO number can be added later once assigned by the carrier.")
        
        bol_pdf = st.file_uploader("Upload BOL PDF", type="pdf")
        vex_pdfs = st.file_uploader("Attach VEX PDFs", type="pdf", accept_multiple_files=True, key="vex_uploader")

        if st.button("Add Shipment", type="primary"):
            if not bol_pdf:
                st.warning("Please upload the BOL PDF.")
            else:
                try:
                    result = supabase.table("shipments").insert({
                        "carrier": "Pending — BOL parser not yet built",
                        "pro_number": "TBD",
                        "status": "in_transit"
                    }).execute()
                    shipment_id = result.data[0]["id"]

                    for vex_pdf in (vex_pdfs or []):
                        with pdfplumber.open(vex_pdf) as pdf:
                            page = pdf.pages[0]
                            text = page.extract_text()

                        vex_match = re.search(r"VEX\s*(\d+)", text, re.IGNORECASE)
                        date_match = re.search(r"(\d{4}-\d{2}-\d{2})T", text)

                        if vex_match:
                            vex_number = f"VEX-{vex_match.group(1)}"
                            vex_date = date_match.group(1) if date_match else None

                            supabase.table("shipment_vex").insert({
                                "shipment_id": shipment_id,
                                "vex_number": vex_number,
                            }).execute()

                            if vex_date:
                                supabase.table("vex_numbers").update(
                                    {"vex_date": vex_date}
                                ).eq("vex_number", vex_number).execute()

                    st.success("Shipment created. Add PRO number once assigned.")
                    st.rerun()
                except Exception as e:
                    st.error(f"Error: {e}")

    st.divider()

    shipments = supabase.table("shipments").select("*").order("created_at", desc=True).execute().data
    all_shipment_vex = supabase.table("shipment_vex").select("*").execute().data
    all_vex_numbers = supabase.table("vex_numbers").select("*").execute().data

    if not shipments:
        st.info("No shipments registered yet.")
    else:
        for shipment in shipments:
            s_vex = [v for v in all_shipment_vex if v["shipment_id"] == shipment["id"]]
            vex_tags = ", ".join(v["vex_number"] for v in s_vex) if s_vex else "No VEX attached"
            status = shipment.get("status", "in_transit")
            status_label = "🚚 In Transit" if status == "in_transit" else "✅ Truck Arrived"
            pro = shipment.get("pro_number") or "TBD"

            with st.expander(f"{shipment['carrier']} — PRO: {pro} — {status_label}"):
                st.markdown(f"**VEX Attached:** {vex_tags}")

                # PRO number field
                if pro == "TBD":
                    st.divider()
                    new_pro = st.text_input("Add PRO Number", placeholder="PRO-XXXXXXXXX", key=f"pro_{shipment['id']}")
                    if st.button("Save PRO", key=f"save_pro_{shipment['id']}"):
                        if new_pro.strip():
                            supabase.table("shipments").update({"pro_number": new_pro.strip()}).eq("id", shipment["id"]).execute()
                            st.success("PRO number saved.")
                            st.rerun()
                        else:
                            st.warning("Enter a valid PRO number.")
                else:
                    st.code(pro, language=None)

                st.divider()
                st.markdown("**Cross-check**")
                for v in s_vex:
                    match = next((x for x in all_vex_numbers if x["vex_number"] == v["vex_number"]), None)
                    if match:
                        inv_data = supabase.table("invoices").select("inv_number, so_number").eq("id", match["invoice_id"]).execute().data
                        if inv_data:
                            inv = inv_data[0]
                            st.markdown(f"✅ {v['vex_number']} matches {inv['inv_number']} — {inv['so_number']}")
                        else:
                            st.markdown(f"⚠️ {v['vex_number']} — INV not found")
                    else:
                        st.markdown(f"⚠️ {v['vex_number']} — not assigned to any INV")

                st.divider()
                if status == "in_transit":
                    if st.button("✅ Mark Truck Arrived", key=f"arrived_{shipment['id']}"):
                        from datetime import date
                        supabase.table("shipments").update({
                            "status": "truck_arrived",
                            "arrived_at": date.today().isoformat()
                        }).eq("id", shipment["id"]).execute()
                        st.rerun()
                else:
                    arrived = shipment.get("arrived_at") or "—"
                    st.markdown(f"🟢 Truck arrived — {arrived}")
                    
                    if st.button("Modify arrival date", key=f"mod_{shipment['id']}"):
                        st.session_state[f"editing_date_{shipment['id']}"] = True

                    if st.session_state.get(f"editing_date_{shipment['id']}"):
                        new_date = st.date_input("Select new arrival date", key=f"arrdate_{shipment['id']}")
                        c1, c2 = st.columns([1, 1])
                        with c1:
                            if st.button("✅ Confirm date", key=f"upddate_{shipment['id']}"):
                                supabase.table("shipments").update({
                                    "arrived_at": new_date.isoformat()
                                }).eq("id", shipment["id"]).execute()
                                del st.session_state[f"editing_date_{shipment['id']}"]
                                st.success("Date updated.")
                                st.rerun()
                        with c2:
                            if st.button("Cancel", key=f"canceldate_{shipment['id']}"):
                                del st.session_state[f"editing_date_{shipment['id']}"]
                                st.rerun()