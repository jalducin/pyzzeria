from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api import routes_auth, routes_products, routes_sales
from app.core.config import get_settings
from app.core.errors import POSError, pos_error_handler
from app.core.logging import configure_logging, new_request_id

configure_logging()
settings = get_settings()

app = FastAPI(title="POS Retail API", version="1.1.0")


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request.state.request_id = new_request_id()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


app.add_exception_handler(POSError, pos_error_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Error interno",
                "request_id": request_id,
                "details": {},
            }
        },
    )


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "env": settings.environment, "app": settings.app_name}


app.include_router(routes_auth.router)
app.include_router(routes_products.router)
app.include_router(routes_sales.router)
