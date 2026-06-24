from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import orders, supplier_tracking, receiving_history, ready_to_dispatch, customers, documents
from app.quotes.quotes_router import router as quotes_router
from app.quotes.clients_router import router as quotes_clients_router

app = FastAPI(title="SRG Operations API")

ALLOWED_ORIGINS = [
    "https://veral-srg-app.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(orders.router)
app.include_router(supplier_tracking.router)
app.include_router(ready_to_dispatch.router)
app.include_router(receiving_history.router)
app.include_router(customers.router)
app.include_router(documents.router)
app.include_router(quotes_router)
app.include_router(quotes_clients_router)

@app.get("/")
def root():
    return {"status": "SRG Operations API running"}
