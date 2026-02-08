from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.database import get_db
from app.models import Download, DownloadStatus, ContentType
from app.schemas import DownloadCreate, DownloadResponse
from app.services import get_download_manager

router = APIRouter()


class BatchDownloadsRequest(BaseModel):
    downloads: List[DownloadCreate]


def get_next_1am() -> datetime:
    """Get the next 1 AM timestamp"""
    now = datetime.now()
    next_1am = now.replace(hour=1, minute=0, second=0, microsecond=0)
    if now.hour >= 1:
        next_1am += timedelta(days=1)
    return next_1am


@router.get("", response_model=List[DownloadResponse])
async def get_downloads(
    status: str = None,
    db: Session = Depends(get_db)
):
    """Get all downloads, optionally filtered by status"""
    query = db.query(Download)
    
    if status:
        try:
            status_enum = DownloadStatus(status)
            query = query.filter(Download.status == status_enum)
        except ValueError:
            pass
    
    downloads = query.order_by(Download.created_at.desc()).all()
    return downloads


@router.get("/{download_id}", response_model=DownloadResponse)
async def get_download(download_id: int, db: Session = Depends(get_db)):
    """Get a specific download by ID"""
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    return download


@router.post("", response_model=DownloadResponse)
async def create_download(
    download_data: DownloadCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Add a new item to download queue"""
    # Check if already exists
    existing = db.query(Download).filter(
        Download.stream_id == download_data.stream_id,
        Download.status.in_([DownloadStatus.PENDING, DownloadStatus.DOWNLOADING, DownloadStatus.COMPLETED, DownloadStatus.SCHEDULED])
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Content already in queue with status: {existing.status.value}"
        )
    
    is_scheduled = download_data.scheduled or False
    
    # Create download record
    download = Download(
        stream_id=download_data.stream_id,
        title=download_data.title,
        content_type=ContentType(download_data.content_type.value),
        series_name=download_data.series_name,
        season=download_data.season,
        episode=download_data.episode,
        poster_url=download_data.poster_url,
        year=download_data.year,
        file_extension=download_data.file_extension,
        status=DownloadStatus.SCHEDULED if is_scheduled else DownloadStatus.PENDING,
        scheduled=is_scheduled,
        scheduled_time=get_next_1am() if is_scheduled else None
    )
    
    db.add(download)
    db.commit()
    db.refresh(download)
    
    # Starting of download is handled by the queue processor
    
    return download


async def start_download(download_id: int):
    """Background task to process download (kept for backward compatibility or forced starts)"""
    from app.database import SessionLocal
    
    db = SessionLocal()
    try:
        download = db.query(Download).filter(Download.id == download_id).first()
        if not download:
            return
        
        manager = get_download_manager()
        
        if download.content_type == ContentType.MOVIE:
            await manager.download_movie(download, db)
        else:
            await manager.download_episode(download, db)
    finally:
        db.close()


@router.delete("/{download_id}")
async def delete_download(download_id: int, db: Session = Depends(get_db)):
    """Delete a download from queue (does not delete file)"""
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    
    if download.status == DownloadStatus.DOWNLOADING:
        raise HTTPException(status_code=400, detail="Cannot delete while downloading")
    
    db.delete(download)
    db.commit()
    
    return {"message": "Download deleted"}


@router.post("/{download_id}/retry", response_model=DownloadResponse)
async def retry_download(
    download_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Retry a failed download"""
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    
    if download.status != DownloadStatus.ERROR:
        raise HTTPException(status_code=400, detail="Can only retry failed downloads")
    
    download.status = DownloadStatus.PENDING
    download.error_message = None
    download.progress = 0
    db.commit()
    
    return download


@router.post("/batch", response_model=List[DownloadResponse])
async def create_batch_downloads(
    request: BatchDownloadsRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Add multiple items to download queue"""
    created = []
    
    for download_data in request.downloads:
        # Check if already exists
        existing = db.query(Download).filter(
            Download.stream_id == download_data.stream_id,
            Download.status.in_([DownloadStatus.PENDING, DownloadStatus.DOWNLOADING, DownloadStatus.COMPLETED, DownloadStatus.SCHEDULED])
        ).first()
        
        if existing:
            continue
        
        is_scheduled = download_data.scheduled or False
        
        download = Download(
            stream_id=download_data.stream_id,
            title=download_data.title,
            content_type=ContentType(download_data.content_type.value),
            series_name=download_data.series_name,
            season=download_data.season,
            episode=download_data.episode,
            poster_url=download_data.poster_url,
            year=download_data.year,
            file_extension=download_data.file_extension,
            status=DownloadStatus.SCHEDULED if is_scheduled else DownloadStatus.PENDING,
            scheduled=is_scheduled,
            scheduled_time=get_next_1am() if is_scheduled else None
        )
        
        db.add(download)
        db.commit()
        db.refresh(download)
        created.append(download)
    
    return created
