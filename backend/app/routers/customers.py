from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from app.database import supabase_admin as supabase
import uuid

router = APIRouter(prefix="/customers", tags=["customers"])


# --- Schemas ---

class ContactSchema(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_primary: bool = False


class CustomerCreate(BaseModel):
    name: str
    type: str
    country: str
    billing_street: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_postal_code: Optional[str] = None
    shipping_street: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_postal_code: Optional[str] = None
    shipping_country: Optional[str] = None
    contacts: List[ContactSchema] = []


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    country: Optional[str] = None
    billing_street: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_postal_code: Optional[str] = None
    shipping_street: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_postal_code: Optional[str] = None
    shipping_country: Optional[str] = None
    contacts: Optional[List[ContactSchema]] = None


# --- Endpoints ---

@router.get("/")
def list_customers():
    customers = supabase.table("customers").select("*").order("name").execute().data
    all_contacts = supabase.table("customer_contacts").select("*").execute().data

    for c in customers:
        c["contacts"] = [ct for ct in all_contacts if ct["customer_id"] == c["id"]]

    return customers


@router.post("/")
def create_customer(data: CustomerCreate):
    if data.type not in ("domestic", "international"):
        raise HTTPException(status_code=400, detail="type must be 'domestic' or 'international'")

    primary = [c for c in data.contacts if c.is_primary]
    if not primary:
        raise HTTPException(status_code=400, detail="At least one primary contact is required")

    result = supabase.table("customers").insert({
        "name": data.name,
        "type": data.type,
        "country": data.country,
        "billing_street": data.billing_street,
        "billing_city": data.billing_city,
        "billing_state": data.billing_state,
        "billing_postal_code": data.billing_postal_code,
        "shipping_street": data.shipping_street,
        "shipping_city": data.shipping_city,
        "shipping_state": data.shipping_state,
        "shipping_postal_code": data.shipping_postal_code,
        "shipping_country": data.shipping_country,
    }).execute()

    customer_id = result.data[0]["id"]

    for contact in data.contacts:
        supabase.table("customer_contacts").insert({
            "customer_id": customer_id,
            "name": contact.name,
            "email": contact.email,
            "phone": contact.phone,
            "is_primary": contact.is_primary,
        }).execute()

    return result.data[0]


@router.patch("/{customer_id}")
def update_customer(customer_id: str, data: CustomerUpdate):
    fields = [
        "name", "type", "country",
        "billing_street", "billing_city", "billing_state", "billing_postal_code",
        "shipping_street", "shipping_city", "shipping_state", "shipping_postal_code",
        "shipping_country"
    ]
    payload = {f: getattr(data, f) for f in fields if getattr(data, f) is not None}

    if payload:
        result = supabase.table("customers").update(payload).eq("id", customer_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Customer not found")

    if data.contacts is not None:
        supabase.table("customer_contacts").delete().eq("customer_id", customer_id).execute()
        for contact in data.contacts:
            supabase.table("customer_contacts").insert({
                "customer_id": customer_id,
                "name": contact.name,
                "email": contact.email,
                "phone": contact.phone,
                "is_primary": contact.is_primary,
            }).execute()

    return {"updated": customer_id}


@router.delete("/{customer_id}")
def delete_customer(customer_id: str):
    result = supabase.table("customers").delete().eq("id", customer_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"deleted": customer_id}


# --- Documents ---

@router.get("/{customer_id}/documents")
def list_documents(customer_id: str):
    result = supabase.table("customer_documents").select("*").eq("customer_id", customer_id).order("uploaded_at", desc=True).execute()
    return result.data


@router.post("/{customer_id}/documents")
async def upload_document(
    customer_id: str,
    document_type: str = Form(...),
    label: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    if document_type not in ("tax_certificate", "other"):
        raise HTTPException(status_code=400, detail="document_type must be 'tax_certificate' or 'other'")

    contents = await file.read()
    file_path = f"customers/{customer_id}/{uuid.uuid4()}_{file.filename}"

    supabase.storage.from_("documents").upload(
        file_path,
        contents,
        {"content-type": file.content_type}
    )

    public_url = supabase.storage.from_("documents").get_public_url(file_path)

    record = {
        "customer_id": customer_id,
        "document_type": document_type,
        "label": label,
        "file_url": public_url,
        "file_name": file.filename,
        "expiry_date": expiry_date or None,
    }

    result = supabase.table("customer_documents").insert(record).execute()
    return result.data[0]


@router.delete("/{customer_id}/documents/{document_id}")
def delete_document(customer_id: str, document_id: str):
    result = supabase.table("customer_documents").delete().eq("id", document_id).eq("customer_id", customer_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": document_id}