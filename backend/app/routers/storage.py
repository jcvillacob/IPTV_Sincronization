import os
import shutil
from fastapi import APIRouter
from app.config import get_settings
from app.schemas import StorageInfo

router = APIRouter()


@router.get("/info", response_model=StorageInfo)
async def get_storage_info():
    """Get storage information for the media path"""
    settings = get_settings()
    media_path = settings.media_path
    
    # Ensure path exists
    os.makedirs(media_path, exist_ok=True)
    
    try:
        usage = shutil.disk_usage(media_path)
        
        return StorageInfo(
            total_bytes=usage.total,
            used_bytes=usage.used,
            free_bytes=usage.free,
            total_gb=round(usage.total / (1024**3), 2),
            used_gb=round(usage.used / (1024**3), 2),
            free_gb=round(usage.free / (1024**3), 2),
            percent_used=round((usage.used / usage.total) * 100, 1)
        )
    except Exception:
        return StorageInfo(
            total_bytes=0,
            used_bytes=0,
            free_bytes=0,
            total_gb=0,
            used_gb=0,
            free_gb=0,
            percent_used=0
        )


@router.get("/archive/info", response_model=StorageInfo)
async def get_archive_storage_info():
    """Get storage information for the archive path"""
    settings = get_settings()
    archive_path = settings.archive_path
    
    os.makedirs(archive_path, exist_ok=True)
    
    try:
        usage = shutil.disk_usage(archive_path)
        
        return StorageInfo(
            total_bytes=usage.total,
            used_bytes=usage.used,
            free_bytes=usage.free,
            total_gb=round(usage.total / (1024**3), 2),
            used_gb=round(usage.used / (1024**3), 2),
            free_gb=round(usage.free / (1024**3), 2),
            percent_used=round((usage.used / usage.total) * 100, 1)
        )
    except Exception:
        return StorageInfo(
            total_bytes=0,
            used_bytes=0,
            free_bytes=0,
            total_gb=0,
            used_gb=0,
            free_gb=0,
            percent_used=0
        )
