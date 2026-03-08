from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    """Base exception for all application-level errors."""
    def __init__(self, status_code: int, detail: str, code: str = "ERROR"):
        self.status_code = status_code
        self.detail = detail
        self.code = code


class NotFoundError(AppException):
    """Raised when a requested resource does not exist."""
    def __init__(self, resource: str, id: str | int):
        super().__init__(404, f"{resource} '{id}' not found", "NOT_FOUND")


class ConflictError(AppException):
    """Raised when a create/update operation violates a uniqueness constraint."""
    def __init__(self, detail: str):
        super().__init__(409, detail, "CONFLICT")


class ForbiddenError(AppException):
    """Raised when the authenticated user lacks permission for an action."""
    def __init__(self, detail: str = "Forbidden"):
        super().__init__(403, detail, "FORBIDDEN")


class ValidationError(AppException):
    """Raised when business-logic validation fails outside Pydantic."""
    def __init__(self, detail: str):
        super().__init__(422, detail, "VALIDATION_ERROR")


class ExternalServiceError(AppException):
    """Raised when an external service call (Gemini, ML) fails."""
    def __init__(self, service: str, detail: str):
        super().__init__(502, f"{service}: {detail}", "EXTERNAL_SERVICE_ERROR")


def register_exception_handlers(app: FastAPI) -> None:
    """Attach the global AppException handler to the FastAPI instance."""
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"ok": False, "code": exc.code, "detail": exc.detail},
        )
