from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse


class POSError(HTTPException):
    code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, status_code: int = 500, details: dict | None = None) -> None:
        super().__init__(status_code=status_code, detail=message)
        self.message = message
        self.details = details or {}


class AuthRequired(POSError):
    code = "AUTH_REQUIRED"

    def __init__(self, message: str = "Autenticación requerida") -> None:
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)


class Forbidden(POSError):
    code = "FORBIDDEN"

    def __init__(self, message: str = "Permiso insuficiente") -> None:
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN)


class NotFound(POSError):
    code = "NOT_FOUND"

    def __init__(self, message: str = "Recurso no encontrado") -> None:
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)


class ValidationError(POSError):
    code = "VALIDATION_ERROR"

    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(message, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, details=details)


class StockInsufficient(POSError):
    code = "STOCK_INSUFFICIENT"

    def __init__(self, message: str = "Stock insuficiente", details: dict | None = None) -> None:
        super().__init__(message, status_code=status.HTTP_409_CONFLICT, details=details)


class PaymentDeclined(POSError):
    code = "PAYMENT_DECLINED"

    def __init__(self, message: str = "Pago rechazado", details: dict | None = None) -> None:
        super().__init__(message, status_code=status.HTTP_402_PAYMENT_REQUIRED, details=details)


async def pos_error_handler(request: Request, exc: POSError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "request_id": request_id,
                "details": exc.details,
            }
        },
    )
