from fastapi import APIRouter, Depends

from app.quotes.models import ClientItem, ClientListResponse
from app.quotes.repositories import clients_repo
from app.auth import get_current_user

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("", response_model=ClientListResponse)
def list_clients(search: str | None = None, user: dict = Depends(get_current_user)):
    names = clients_repo.list_client_names()
    items = [ClientItem(id=c["id"], name=c["name"]) for c in names]
    return ClientListResponse(items=items)
