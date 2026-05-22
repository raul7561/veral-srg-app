from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import orders, supplier_tracking, receiving_history, ready_to_dispatch, customers

app = FastAPI(title="SRG Operations API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders.router)
app.include_router(supplier_tracking.router)
app.include_router(ready_to_dispatch.router)
app.include_router(receiving_history.router)
app.include_router(customers.router)

@app.get("/")
def root():
    return {"status": "SRG Operations API running"}