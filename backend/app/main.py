from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager, suppress
import asyncio

from app.database import engine, Base, run_idempotent_migrations
from app.routers import categories, content, downloads, storage
from app.services.download_manager import process_download_queue
from app.services.iptv_client import get_iptv_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    Base.metadata.create_all(bind=engine)
    run_idempotent_migrations()
    
    # Start download queue processor
    queue_task = asyncio.create_task(process_download_queue(), name="download-queue-orchestrator")
    
    yield

    queue_task.cancel()
    with suppress(asyncio.CancelledError):
        await queue_task
    with suppress(Exception):
        await get_iptv_client().close()


app = FastAPI(
    title="IPTV Synchronization API",
    description="API para sincronizar contenido IPTV con estructura Kodi",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(content.router, prefix="/api/content", tags=["Content"])
app.include_router(downloads.router, prefix="/api/downloads", tags=["Downloads"])
app.include_router(storage.router, prefix="/api/storage", tags=["Storage"])


@app.get("/")
async def root():
    return {"message": "IPTV Synchronization API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
