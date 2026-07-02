import math

from app.quotes.models import PriceLevel, QuoteLine


# Multiplicadores sobre el US List. US List = costo / 0.9 (US_LIST factor 1.0).
# Los demas niveles se calculan sobre el US List, no sobre el costo.
LEVEL_MULTIPLIERS: dict[str, float] = {
    "US_LIST": 1.0,
    "LIST_-2": 0.98,
    "LIST_-3": 0.97,
    "LIST_-5": 0.95,
    "LIST_+2": 1.02,
}


def _unit_price(madisa_cost: float, level: PriceLevel) -> float:
    us_list = madisa_cost / 0.9
    multiplier = LEVEL_MULTIPLIERS[level]
    return round(us_list * multiplier, 2)


def _rounded_quantity(quantity: int, minimum_qty: int | None) -> int:
    if not minimum_qty or minimum_qty <= 0:
        return quantity
    return math.ceil(quantity / minimum_qty) * minimum_qty


def calculate_lines(lines: list[QuoteLine], level: PriceLevel) -> list[QuoteLine]:
    result: list[QuoteLine] = []
    for line in lines:
        new_line = line.model_copy()
        new_line.core_deposit = line.core_deposit
        new_line.quantity = _rounded_quantity(line.quantity, line.minimum_qty)
        if line.is_quotable and line.madisa_cost > 0:
            new_line.unit_price = _unit_price(line.madisa_cost, level) + (line.core_deposit or 0)
        else:
            new_line.unit_price = None
        result.append(new_line)
    return result
