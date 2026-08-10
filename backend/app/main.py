import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api import analytics, disruptions, productions, rescue, schedule
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO)
settings = get_settings()

limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.rate_limit_per_minute}/minute"])

app = FastAPI(title="Production Rescue API", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Never leak internal structure/tracebacks; return a compact, safe error shape.
    return JSONResponse(status_code=422, content={"detail": "Invalid request", "errors": exc.errors()})


@app.get("/api/health")
def health():
    return {"status": "ok", "gemini_configured": settings.gemini_configured, "parallel_configured": settings.parallel_configured}


app.include_router(productions.router)
app.include_router(schedule.router)
app.include_router(disruptions.router)
app.include_router(rescue.router)
app.include_router(analytics.router)
