from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

from app.database import engine, Base
from app.routers import categories, content, downloads, storage
from app.services.download_manager import process_download_queue


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    Base.metadata.create_all(bind=engine)
    
    # Start download queue processor
    asyncio.create_task(process_download_queue())
    
    yield


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
