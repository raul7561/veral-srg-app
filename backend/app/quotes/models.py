from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


PriceLevel = Literal["US_LIST", "LIST_-2", "LIST_-3", "LIST_-5", "LIST_+2"]
QuoteStatus = Literal["activo", "anulado"]


class QuoteLine(BaseModel):
    item_number: int
    brand: str
    quantity: int
    part_number: str
    description: str
    madisa_cost: float
    unit_price: float | None = None
    minimum_qty: int | None = None
    replaces_part_number: str | None = None
    is_quotable: bool = True
    unit_weight: float | None = None
    notes: str
    availability_raw: str


class QuoteSummary(BaseModel):
    id: int
    quote_number: str
    quote_date: date
    client_name: str
    sales_rep_name: str
    price_level: PriceLevel
    status: QuoteStatus
    so_number: str | None = None
    total_amount: float
    total_items: int


class ParseResponse(BaseModel):
    lines: list[QuoteLine]
    lines_generated: int
    lines_discarded: int


class CreateQuoteRequest(BaseModel):
    client_name: str
    price_level: PriceLevel
    shipping_cost: float | None = None
    lines: list[QuoteLine]


class QuoteDetail(QuoteSummary):
    lines: list[QuoteLine]
    shipping_cost: float | None = None
    cancelled_reason: str | None = None
    cancelled_at: datetime | None = None
    is_frozen: bool


class QuoteListResponse(BaseModel):
    items: list[QuoteSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class UpdateQuoteRequest(BaseModel):
    client_name: str | None = None
    price_level: PriceLevel | None = None
    shipping_cost: float | None = None
    lines: list[QuoteLine] | None = None


class CancelQuoteRequest(BaseModel):
    cancelled_reason: str


class ConvertQuoteRequest(BaseModel):
    so_number: str
    customer_id: str


class ClientItem(BaseModel):
    id: str | None = None
    name: str


class ClientListResponse(BaseModel):
    items: list[ClientItem]


class CalculateRequest(BaseModel):
    price_level: PriceLevel
    lines: list[QuoteLine]


class CalculateResponse(BaseModel):
    lines: list[QuoteLine]
