import re

from app.database import supabase_admin as supabase
from app.quotes.models import CreateQuoteRequest

class QuoteNotFound(Exception):
    pass


class QuoteFrozen(Exception):
    pass


class QuoteAlreadyVoided(Exception):
    pass

class QuoteVoided(Exception):
    pass


def create_quote(request: CreateQuoteRequest, sales_rep_name: str, user_id: str | None) -> dict:
    """Crea un quote con numero atomico via la funcion Postgres create_quote.
    Devuelve el quote completo (cabecera + lineas + totales) como dict,
    en el formato que espera el modelo QuoteDetail."""
    lines_payload = [
        {
            "line_number": line.item_number,
            "brand": line.brand,
            "part_number": line.part_number,
            "description": line.description,
            "quantity": line.quantity,
            "minimum_qty": line.minimum_qty,
            "unit_price": line.unit_price,
            "price_level": request.price_level,
            "unit_weight": line.unit_weight,
            "madisa_cost": line.madisa_cost,
            "notes": line.notes,
            "availability_raw": line.availability_raw,
            "replaces_part_number": line.replaces_part_number,
        }
        for line in request.lines
    ]

    response = supabase.rpc(
        "create_quote",
        {
            "p_client_name": request.client_name,
            "p_sales_rep_name": sales_rep_name,
            "p_price_level": request.price_level,
            "p_user_id": user_id,
            "p_customer_id": None,
            "p_shipping_cost": request.shipping_cost,
            "p_lines": lines_payload,
        },
    ).execute()

    return response.data

def get_quote(quote_id: int) -> dict | None:
    """Lee un quote completo por id via la funcion Postgres quote_detail_json.
    Devuelve el QuoteDetail como dict, o None si no existe."""
    response = supabase.rpc(
        "quote_detail_json",
        {"p_quote_id": quote_id},
    ).execute()

    return response.data

def list_quotes(
    page: int,
    page_size: int,
    sales_rep: str | None,
    client_name: str | None,
    status: str | None,
    date_from: str | None,
    date_to: str | None,
    search: str | None,
) -> dict:
    """Lista quotes desde la vista quotes_with_totals, con filtros y paginacion.
    Devuelve {items, total} para que el router arme la respuesta paginada."""
    query = supabase.table("quotes_with_totals").select("*", count="exact")

    if status:
        query = query.eq("status", status)
    if sales_rep:
        query = query.ilike("sales_rep_name", f"%{sales_rep}%")
    if client_name:
        query = query.ilike("client_name", f"%{client_name}%")
    if search:
        query = query.ilike("quote_number", f"%{search}%")
    if date_from:
        query = query.gte("quote_date", date_from)
    if date_to:
        query = query.lte("quote_date", date_to)

    # Orden: mas recientes primero. Paginacion server-side por rango de filas.
    start = (page - 1) * page_size
    end = start + page_size - 1
    query = query.order("id", desc=True).range(start, end)

    response = query.execute()

    return {"items": response.data, "total": response.count}

def cancel_quote(quote_id: int, reason: str, user_id: str | None) -> dict:
    """Anula un quote via la funcion Postgres cancel_quote.
    Traduce los errores de la base a excepciones propias que el router mapea a HTTP."""
    try:
        response = supabase.rpc(
            "cancel_quote",
            {
                "p_quote_id": str(quote_id),
                "p_reason": reason,
                "p_user_id": user_id,
            },
        ).execute()
    except Exception as e:
        message = str(e)
        if "QUOTE_NOT_FOUND" in message:
            raise QuoteNotFound()
        if "QUOTE_FROZEN" in message:
            raise QuoteFrozen()
        if "QUOTE_ALREADY_VOIDED" in message:
            raise QuoteAlreadyVoided()
        raise

    return response.data

def update_quote(request, quote_id: int) -> dict:
    """Edita un quote via la funcion Postgres update_quote: cabecera + reemplazo de lineas.
    Traduce los errores de la base a excepciones propias que el router mapea a HTTP."""
    lines_payload = None
    if request.lines is not None:
        lines_payload = [
            {
                "line_number": line.item_number,
                "brand": line.brand,
                "part_number": line.part_number,
                "description": line.description,
                "quantity": line.quantity,
                "minimum_qty": line.minimum_qty,
                "unit_price": line.unit_price,
                "price_level": request.price_level,
                "unit_weight": line.unit_weight,
                "madisa_cost": line.madisa_cost,
                "notes": line.notes,
                "availability_raw": line.availability_raw,
                "replaces_part_number": line.replaces_part_number,
            }
            for line in request.lines
        ]

    try:
        response = supabase.rpc(
            "update_quote",
            {
                "p_quote_id": str(quote_id),
                "p_client_name": request.client_name,
                "p_price_level": request.price_level,
                "p_shipping_cost": request.shipping_cost,
                "p_lines": lines_payload,
            },
        ).execute()
    except Exception as e:
        message = str(e)
        if "QUOTE_NOT_FOUND" in message:
            raise QuoteNotFound()
        if "QUOTE_FROZEN" in message:
            raise QuoteFrozen()
        if "QUOTE_VOIDED" in message:
            raise QuoteVoided()
        raise

    return response.data

def convert_quote_to_so(quote_id: int, so_number: str, customer_id: str) -> dict:
    digits = re.sub(r"\D", "", so_number or "")
    if not digits:
        raise ValueError("SO number must contain digits")
    so_number = f"SO-{digits}"

    try:
        response = supabase.rpc(
            "convert_quote_to_so",
            {
                "p_quote_id": str(quote_id),
                "p_so_number": so_number,
                "p_customer_id": customer_id,
            },
        ).execute()
    except Exception as e:
        message = str(e)
        if "QUOTE_NOT_FOUND" in message:
            raise QuoteNotFound()
        if "QUOTE_FROZEN" in message:
            raise QuoteFrozen()
        if "QUOTE_VOIDED" in message:
            raise QuoteVoided()
        raise
    return response.data
