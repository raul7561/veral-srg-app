from app.database import supabase_admin as supabase


def list_client_names() -> list[dict]:
    """Combina nombres de customers (clientes registrados) y client_name de
    quotes (todo lo cotizado), para el autocompletado del campo cliente.
    Normaliza espacios, deduplica sin distinguir mayusculas (conserva la
    primera forma encontrada), y ordena alfabeticamente.
    Los nombres que solo vienen de quotes salen con id=None."""
    # 1. Clientes registrados (con id)
    customers_res = supabase.table("customers").select("id, name").execute()
    # 2. Nombres cotizados (sin id de cliente)
    quotes_res = supabase.table("quotes").select("client_name").execute()

    seen = {}  # clave: nombre en minusculas -> dict {id, name}

    for row in customers_res.data or []:
        name = (row.get("name") or "").strip()
        if not name:
            continue
        key = name.lower()
        if key not in seen:
            seen[key] = {"id": row.get("id"), "name": name}

    for row in quotes_res.data or []:
        name = (row.get("client_name") or "").strip()
        if not name:
            continue
        key = name.lower()
        if key not in seen:
            seen[key] = {"id": None, "name": name}

    return sorted(seen.values(), key=lambda c: c["name"].lower())
