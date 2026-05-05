import streamlit as st
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

st.set_page_config(page_title="SRG Operations", layout="wide")

st.title("SRG Receiving & Order Management")
st.success("Conectado a Supabase correctamente")

# Test de conexión
try:
    result = supabase.table("invoices").select("*").execute()
    st.write(f"Tablas listas. Invoices en base de datos: {len(result.data)}")
except Exception as e:
    st.error(f"Error de conexión: {e}")
