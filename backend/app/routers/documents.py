from fastapi import APIRouter, Depends, HTTPException
from app.database import supabase_admin
from app.auth import get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/signed-url")
def get_signed_url(path: str, user: dict = Depends(get_current_user)):
    """Genera una URL firmada temporal para un archivo del bucket privado 'documents'.
    El 'path' es la ruta del archivo dentro del bucket (ej: 'SO-63409/SO63409.pdf').
    Expira en 300 segundos."""
    try:
        result = supabase_admin.storage.from_("documents").create_signed_url(path, 300)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"No se pudo firmar el archivo: {str(e)}")

    signed = result.get("signedURL") or result.get("signed_url")
    if not signed:
        raise HTTPException(status_code=404, detail="No se pudo generar la URL firmada")

    return {"signed_url": signed}
