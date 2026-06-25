import re
import tempfile
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException, Response, UploadFile
from fastapi import Depends

from app.auth import get_current_user
from app.quotes.models import (
    CalculateRequest,
    CalculateResponse,
    CancelQuoteRequest,
    ConvertQuoteRequest,
    CreateQuoteRequest,
    ParseResponse,
    PriceLevel,
    QuoteDetail,
    QuoteLine,
    QuoteListResponse,
    QuoteSummary,
    UpdateQuoteRequest,
)

from app.quotes.repositories import quotes_repo
from app.quotes.repositories.quotes_repo import QuoteNotFound, QuoteFrozen, QuoteAlreadyVoided, QuoteVoided
from app.quotes.services import parser
from app.quotes.services import pricing
from app.quotes.services import pdf, excel

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


MOCK_LINES = [
    QuoteLine(
        item_number=1,
        brand="CAT",
        quantity=2,
        part_number="5P-2907",
        description="SEAL",
        madisa_cost=12.5,
        unit_price=15.0,
        minimum_qty=2,
        unit_weight=0.25,
        notes="Disponible",
        availability_raw="In Stock",
    ),
    QuoteLine(
        item_number=2,
        brand="CAT",
        quantity=1,
        part_number="7W-0016",
        description="GASKET",
        madisa_cost=48.75,
        unit_price=58.5,
        minimum_qty=1,
        unit_weight=0.4,
        notes="Disponible",
        availability_raw="In Stock",
    ),
]

MOCK_SUMMARY = QuoteSummary(
    id=1,
    quote_number="2026-3115",
    quote_date=date(2026, 6, 11),
    client_name="Constructora Norte",
    sales_rep_name="Maria Lopez",
    price_level="US_LIST",
    status="activo",
    so_number=None,
    total_amount=73.5,
    total_items=2,
)

MOCK_DETAIL = QuoteDetail(
    id=1,
    quote_number="2026-3115",
    quote_date=date(2026, 6, 11),
    client_name="Constructora Norte",
    sales_rep_name="Maria Lopez",
    price_level="US_LIST",
    status="activo",
    so_number=None,
    total_amount=73.5,
    total_items=2,
    lines=MOCK_LINES,
    shipping_cost=None,
    cancelled_reason=None,
    cancelled_at=None,
    is_frozen=False,
)

MOCK_CANCELLED_DETAIL = QuoteDetail(
    id=1,
    quote_number="2026-3115",
    quote_date=date(2026, 6, 11),
    client_name="Constructora Norte",
    sales_rep_name="Maria Lopez",
    price_level="US_LIST",
    status="anulado",
    so_number=None,
    total_amount=73.5,
    total_items=2,
    lines=MOCK_LINES,
    shipping_cost=None,
    cancelled_reason="Cliente solicito cancelacion",
    cancelled_at=datetime(2026, 6, 11, 12, 0, 0),
    is_frozen=False,
)


@router.post("/parse", response_model=ParseResponse)
def parse_quote(file: UploadFile, price_level: PriceLevel = Form("US_LIST"), user: dict = Depends(get_current_user)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".csv", ".xlsx", ".xltm", ".xlsm"}:
        raise HTTPException(
            status_code=400,
            detail="Formato no soportado. Se espera .csv, .xlsx, .xltm o .xlsm.",
        )

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name

    try:
        return parser.parse_export(tmp_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@router.post("/calculate", response_model=CalculateResponse)
def calculate_quote(request: CalculateRequest, user: dict = Depends(get_current_user)):
    lines = pricing.calculate_lines(request.lines, request.price_level)
    return CalculateResponse(lines=lines)


@router.post("/preview")
def preview_quote(request: CreateQuoteRequest, user: dict = Depends(get_current_user)):
    recalculated_lines = pricing.calculate_lines(request.lines, request.price_level)
    total_amount = sum(
        (line.unit_price or 0) * line.quantity for line in recalculated_lines
    )
    quote_dict = {
        "client_name": request.client_name,
        "sales_rep_name": user["full_name"],
        "price_level": request.price_level,
        "shipping_cost": request.shipping_cost,
        "total_amount": total_amount,
        "lines": [line.model_dump() for line in recalculated_lines],
    }
    html = pdf.build_quote_html(quote_dict)
    return Response(content=html, media_type="text/html")


@router.post("", response_model=QuoteDetail, status_code=201)
def create_quote(request: CreateQuoteRequest, user: dict = Depends(get_current_user)):
    recalculated_lines = pricing.calculate_lines(request.lines, request.price_level)
    request = request.model_copy(update={"lines": recalculated_lines})
    quote = quotes_repo.create_quote(
        request=request,
        sales_rep_name=user["full_name"],
        user_id=user["id"],
    )
    return quote


@router.get("/{quote_id}/excel")
def download_quote_excel(quote_id: int, user: dict = Depends(get_current_user)):
    quote = quotes_repo.get_quote(quote_id)
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote no encontrado")
    xlsx_bytes = excel.generate_quote_excel(quote)
    number = quote.get("quote_number", quote_id)
    client = _safe_filename_part(quote.get("client_name", ""))
    date = quote.get("quote_date", "")
    parts = [f"Quote_{number}"]
    if client:
        parts.append(client)
    if date:
        parts.append(str(date))
    filename = "_".join(parts) + ".xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _safe_filename_part(text: str) -> str:
    """Limpia un texto para usarlo en un nombre de archivo: quita caracteres
    invalidos, colapsa espacios a guiones bajos, recorta a 50 chars."""
    text = (text or "").strip()
    text = re.sub(r'[\\/:*?"<>|&]', "", text)  # caracteres invalidos
    text = re.sub(r"\s+", "_", text)            # espacios a guion bajo
    text = re.sub(r"_+", "_", text).strip("_")  # colapsa guiones repetidos
    return text[:50]


@router.get("/{quote_id}/pdf")
def download_quote_pdf(quote_id: int, user: dict = Depends(get_current_user)):
    quote = quotes_repo.get_quote(quote_id)
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote no encontrado")
    pdf_bytes = pdf.generate_quote_pdf(quote)
    number = quote.get("quote_number", quote_id)
    client = _safe_filename_part(quote.get("client_name", ""))
    date = quote.get("quote_date", "")
    parts = [f"Quote_{number}"]
    if client:
        parts.append(client)
    if date:
        parts.append(str(date))
    filename = "_".join(parts) + ".pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{quote_id}/html")
def quote_html(quote_id: int, user: dict = Depends(get_current_user)):
    quote = quotes_repo.get_quote(quote_id)
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote no encontrado")
    html = pdf.build_quote_html(quote)
    return Response(content=html, media_type="text/html")


@router.get("", response_model=QuoteListResponse)
def list_quotes(
    page: int = 1,
    page_size: int = 20,
    sales_rep: str | None = None,
    client_name: str | None = None,
    status: str = "activo",
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    user: dict = Depends(get_current_user),
):
    result = quotes_repo.list_quotes(
        page=page,
        page_size=page_size,
        sales_rep=sales_rep,
        client_name=client_name,
        status=status,
        date_from=date_from.isoformat() if date_from else None,
        date_to=date_to.isoformat() if date_to else None,
        search=search,
    )
    total = result["total"] or 0
    total_pages = (total + page_size - 1) // page_size

    return QuoteListResponse(
        items=result["items"],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{quote_id}", response_model=QuoteDetail)
def get_quote(quote_id: int, user: dict = Depends(get_current_user)):
    quote = quotes_repo.get_quote(quote_id)
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote no encontrado")
    return quote


@router.patch("/{quote_id}", response_model=QuoteDetail)
def update_quote(quote_id: int, request: UpdateQuoteRequest, user: dict = Depends(get_current_user)):
    try:
        quote = quotes_repo.update_quote(request=request, quote_id=quote_id)
    except QuoteNotFound:
        raise HTTPException(status_code=404, detail="Quote no encontrado")
    except QuoteFrozen:
        raise HTTPException(status_code=409, detail="Quote convertido a SO, no se puede editar")
    except QuoteVoided:
        raise HTTPException(status_code=409, detail="Quote anulado, no se puede editar")
    return quote


@router.post("/{quote_id}/cancel", response_model=QuoteDetail)
def cancel_quote(quote_id: int, request: CancelQuoteRequest, user: dict = Depends(get_current_user)):
    try:
        quote = quotes_repo.cancel_quote(
            quote_id=quote_id,
            reason=request.cancelled_reason,
            user_id=user["id"],
        )
    except QuoteNotFound:
        raise HTTPException(status_code=404, detail="Quote no encontrado")
    except QuoteFrozen:
        raise HTTPException(status_code=409, detail="Quote convertido a SO, no se puede anular")
    except QuoteAlreadyVoided:
        raise HTTPException(status_code=409, detail="Quote ya esta anulado")
    return quote


@router.post("/{quote_id}/convert", response_model=QuoteDetail)
def convert_quote(quote_id: int, request: ConvertQuoteRequest, user: dict = Depends(get_current_user)):
    try:
        quote = quotes_repo.convert_quote_to_so(
            quote_id=quote_id,
            so_number=request.so_number,
            customer_id=request.customer_id,
        )
    except QuoteNotFound:
        raise HTTPException(status_code=404, detail="Quote no encontrado")
    except QuoteFrozen:
        raise HTTPException(status_code=409, detail="Quote ya convertido a SO, no se puede reconvertir")
    except QuoteVoided:
        raise HTTPException(status_code=409, detail="Quote anulado, no se puede convertir")
    return quote
