import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import init_db
from app.api.routes import api_router
from app.websocket.routes import ws_router
from app.kafka.producer import kafka_producer
from app.kafka.consumer import start_consumers
from app.services.ppe_buffer import ppe_buffer
from app.utils.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    generic_exception_handler,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

_consumer_tasks = []


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("Starting IS4 AI Surveillance System...")

    # Initialize DB (use Alembic in production instead)
    await init_db()
    logger.info("Database initialized.")

    # Start Kafka producer
    await kafka_producer.start()

    # Start PPE event buffer (batches DB writes every 2s)
    ppe_buffer.start()

    # Start Kafka consumers as background tasks
    tasks = start_consumers()
    _consumer_tasks.extend(tasks)

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("Shutting down...")

    for task in _consumer_tasks:
        task.cancel()

    # Flush remaining buffered PPE events before exit
    await ppe_buffer.stop()

    await kafka_producer.stop()
    logger.info("Shutdown complete.")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Production-ready AI Surveillance Backend — PPE, Face Recognition, Idle & Zone Detection",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.mount(
    "/ppe_violations",
    StaticFiles(directory="/home/hacker/Projects/ai/models/ppe_violations"),
    name="ppe_violations"
    )

    # ── Exception Handlers ────────────────────────────────────────────────────
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(api_router, prefix=settings.API_V1_STR)
    app.include_router(ws_router)  # WebSocket routes at root level

    # ── Health Check ──────────────────────────────────────────────────────────
    @app.get("/health", tags=["Health"])
    async def health() -> dict:
        return {"status": "ok", "version": settings.APP_VERSION}

    return app


app = create_app()
