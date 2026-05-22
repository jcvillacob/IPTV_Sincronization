from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from zoneinfo import ZoneInfo
import re

from app.database import get_db
from app.models import Download, DownloadStatus, ContentType
from app.schemas import DownloadCreate, DownloadResponse
from app.services import get_download_manager, get_iptv_client
from app.config import get_settings

router = APIRouter()


class BatchDownloadsRequest(BaseModel):
    downloads: List[DownloadCreate]


_EPISODE_CODE_RE = re.compile(r"[Ss](\d{1,3})\s*[-_. ]?[Ee](\d{1,4})")
_ACTIVE_QUEUE_STATUSES = [
    DownloadStatus.PENDING,
    DownloadStatus.DOWNLOADING,
    DownloadStatus.COMPLETED,
    DownloadStatus.SCHEDULED,
]


def _normalize_text(value: Optional[str]) -> str:
    return " ".join((value or "").strip().lower().split())


def _to_positive_int(value: object) -> Optional[int]:
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _normalize_episode_fields(
    season: Optional[int],
    episode: Optional[int],
    title: Optional[str],
) -> tuple[Optional[int], Optional[int]]:
    parsed_season: Optional[int] = None
    parsed_episode: Optional[int] = None
    match = _EPISODE_CODE_RE.search((title or "").strip())
    if match:
        parsed_season = _to_positive_int(match.group(1))
        parsed_episode = _to_positive_int(match.group(2))

    normalized_season = parsed_season or _to_positive_int(season)
    normalized_episode = parsed_episode or _to_positive_int(episode)
    return normalized_season, normalized_episode


def _build_episode_key(
    series_id: Optional[int],
    series_name: Optional[str],
    season: Optional[int],
    episode: Optional[int],
    title: Optional[str],
) -> Optional[str]:
    series_key = f"id:{series_id}" if series_id is not None else f"name:{_normalize_text(series_name)}"
    if series_key == "name:":
        return None

    normalized_season, normalized_episode = _normalize_episode_fields(season, episode, title)
    if normalized_season and normalized_episode:
        return f"{series_key}:s{normalized_season:04d}e{normalized_episode:04d}"

    title_key = _normalize_text(title)
    if title_key:
        return f"{series_key}:title:{title_key}"
    return None


def _episode_exists_by_logical_key(
    db: Session,
    episode_key: str,
    series_id: Optional[int],
    series_name: Optional[str],
) -> bool:
    candidates = db.query(Download).filter(
        Download.content_type == ContentType.EPISODE,
        Download.status.in_(_ACTIVE_QUEUE_STATUSES),
    ).all()

    normalized_series_name = _normalize_text(series_name)
    for existing in candidates:
        same_series = False
        if series_id is not None and existing.series_id == series_id:
            same_series = True
        elif series_id is None and _normalize_text(existing.series_name) == normalized_series_name:
            same_series = True

        if not same_series:
            continue

        existing_key = _build_episode_key(
            existing.series_id,
            existing.series_name,
            existing.season,
            existing.episode,
            existing.title,
        )
        if existing_key == episode_key:
            return True
    return False


def _is_retry_exhausted(download: Download) -> bool:
    if download.status != DownloadStatus.PAUSED:
        return False
    return "reintentos agotados" in (download.error_message or "").lower()


def get_next_1am() -> datetime:
    """Get the next local 1 AM converted to UTC."""
    settings = get_settings()
    tz = ZoneInfo(settings.schedule_timezone)
    now_local = datetime.now(tz)
    next_local_1am = now_local.replace(hour=1, minute=0, second=0, microsecond=0)
    if now_local.hour >= 1:
        next_local_1am += timedelta(days=1)
    return next_local_1am.astimezone(timezone.utc)


@router.get("", response_model=List[DownloadResponse])
async def get_downloads(
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    year: Optional[str] = Query(default=None),
    category_id: Optional[str] = Query(default=None),
    content_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    """Get downloads with optional filters"""
    query = db.query(Download)

    if status:
        try:
            status_enum = DownloadStatus(status)
            query = query.filter(Download.status == status_enum)
        except ValueError:
            pass

    if content_type:
        try:
            content_type_enum = ContentType(content_type)
            query = query.filter(Download.content_type == content_type_enum)
        except ValueError:
            pass

    if category_id:
        query = query.filter(Download.category_id == category_id)

    if year:
        query = query.filter(Download.year == year)

    if search:
        like_expr = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Download.title.ilike(like_expr),
                Download.series_name.ilike(like_expr)
            )
        )

    downloads = query.order_by(Download.created_at.desc()).all()
    return downloads


@router.post("/reschedule-all-paused")
async def reschedule_all_paused(db: Session = Depends(get_db)):
    """Reschedule all disk-full-paused downloads to next day 1 AM"""
    paused = db.query(Download).filter(
        Download.status == DownloadStatus.PAUSED,
        Download.disk_full_paused == True
    ).all()

    if not paused:
        return {"message": "No hay descargas pausadas por disco lleno", "count": 0}

    next_time = get_next_1am()

    for dl in paused:
        dl.status = DownloadStatus.SCHEDULED
        dl.scheduled = True
        dl.scheduled_time = next_time
        dl.disk_full_paused = False
        dl.error_message = None

    db.commit()

    return {
        "message": f"{len(paused)} descargas reprogramadas para {next_time.strftime('%Y-%m-%d %H:%M')}",
        "count": len(paused),
        "scheduled_time": next_time.isoformat()
    }


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
    content_type = ContentType(download_data.content_type.value)
    normalized_season = download_data.season
    normalized_episode = download_data.episode
    episode_key: Optional[str] = None
    if content_type == ContentType.EPISODE:
        normalized_season, normalized_episode = _normalize_episode_fields(
            download_data.season,
            download_data.episode,
            download_data.title,
        )
        episode_key = _build_episode_key(
            download_data.series_id,
            download_data.series_name,
            normalized_season,
            normalized_episode,
            download_data.title,
        )

    # Check if already exists
    existing = db.query(Download).filter(
        Download.stream_id == download_data.stream_id,
        Download.status.in_(_ACTIVE_QUEUE_STATUSES)
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Content already in queue with status: {existing.status.value}"
        )

    if episode_key and _episode_exists_by_logical_key(
        db,
        episode_key,
        download_data.series_id,
        download_data.series_name,
    ):
        raise HTTPException(
            status_code=400,
            detail="Episode already in queue or downloaded",
        )
    
    is_scheduled = download_data.scheduled or False
    
    # Create download record
    download = Download(
        stream_id=download_data.stream_id,
        title=download_data.title,
        content_type=content_type,
        series_name=download_data.series_name,
        series_id=download_data.series_id,
        season=normalized_season,
        episode=normalized_episode,
        category_id=download_data.category_id,
        category_name=download_data.category_name,
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
        # Mark as deleted so the manager can stop it
        # Setting status to something else (e.g. cancelled) or just delete record
        # Ideally the manager checks if record exists.
        pass
    
    db.delete(download)
    db.commit()
    
    return {"message": "Download deleted"}


@router.post("/{download_id}/pause", response_model=DownloadResponse)
async def pause_download(download_id: int, db: Session = Depends(get_db)):
    """Pause a download"""
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    
    if download.status not in [DownloadStatus.PENDING, DownloadStatus.DOWNLOADING]:
        raise HTTPException(status_code=400, detail="Cannot pause completed or failed downloads")
        
    download.status = DownloadStatus.PAUSED
    db.commit()
    return download


@router.post("/{download_id}/start", response_model=DownloadResponse)
async def force_start_download(download_id: int, db: Session = Depends(get_db)):
    """Force a scheduled/paused download to start immediately."""
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")

    if download.status in [DownloadStatus.COMPLETED, DownloadStatus.ARCHIVED]:
        raise HTTPException(status_code=400, detail="Cannot start completed or archived downloads")

    if download.status == DownloadStatus.DOWNLOADING:
        return download

    download.status = DownloadStatus.PENDING
    download.scheduled = False
    download.scheduled_time = None
    download.disk_full_paused = False
    download.next_retry_at = None
    download.retry_count = 0
    if download.error_message and "disco lleno" in download.error_message.lower():
        download.error_message = None
    db.commit()
    db.refresh(download)
    return download


@router.post("/{download_id}/resume", response_model=DownloadResponse)
async def resume_download(download_id: int, db: Session = Depends(get_db)):
    """Resume a paused download"""
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
        
    if download.status != DownloadStatus.PAUSED:
        raise HTTPException(status_code=400, detail="Download is not paused")

    download.status = DownloadStatus.PENDING
    download.disk_full_paused = False
    download.error_message = None
    download.next_retry_at = None
    download.retry_count = 0
    db.commit()
    return download


@router.post("/{download_id}/priority", response_model=DownloadResponse)
async def set_priority(download_id: int, priority: int = 1, db: Session = Depends(get_db)):
    """Set download priority (higher number = higher priority)"""
    download = db.query(Download).filter(Download.id == download_id).first()
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
        
    download.priority = priority
    db.commit()
    return download


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
    
    if download.status != DownloadStatus.ERROR and not _is_retry_exhausted(download):
        raise HTTPException(status_code=400, detail="Can only retry failed or retry-exhausted paused downloads")
    
    download.status = DownloadStatus.PENDING
    download.error_message = None
    download.progress = 0
    download.next_retry_at = None
    download.retry_count = 0
    db.commit()
    
    return download


@router.post("/batch", response_model=List[DownloadResponse])
async def create_batch_downloads(
    request: BatchDownloadsRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Add multiple items to download queue"""
    created: List[Download] = []

    requested_stream_ids = {
        item.stream_id
        for item in request.downloads
        if item.stream_id
    }
    existing_stream_ids = {
        row[0]
        for row in db.query(Download.stream_id).filter(
            Download.stream_id.in_(requested_stream_ids) if requested_stream_ids else False,
            Download.status.in_(_ACTIVE_QUEUE_STATUSES),
        ).all()
    }

    requested_episode_series_ids = {
        item.series_id
        for item in request.downloads
        if item.content_type.value == ContentType.EPISODE.value and item.series_id is not None
    }
    requested_episode_series_names = {
        _normalize_text(item.series_name)
        for item in request.downloads
        if item.content_type.value == ContentType.EPISODE.value and item.series_id is None and _normalize_text(item.series_name)
    }

    existing_episode_keys: set[str] = set()
    if requested_episode_series_ids or requested_episode_series_names:
        existing_episode_candidates = db.query(Download).filter(
            Download.content_type == ContentType.EPISODE,
            Download.status.in_(_ACTIVE_QUEUE_STATUSES),
        ).all()
        for row in existing_episode_candidates:
            if row.series_id in requested_episode_series_ids:
                pass
            elif _normalize_text(row.series_name) in requested_episode_series_names:
                pass
            else:
                continue
            key = _build_episode_key(row.series_id, row.series_name, row.season, row.episode, row.title)
            if key:
                existing_episode_keys.add(key)

    seen_stream_ids: set[str] = set()
    seen_episode_keys: set[str] = set()

    for download_data in request.downloads:
        if not download_data.stream_id:
            continue
        if download_data.stream_id in existing_stream_ids or download_data.stream_id in seen_stream_ids:
            continue

        content_type = ContentType(download_data.content_type.value)
        normalized_season = download_data.season
        normalized_episode = download_data.episode
        episode_key: Optional[str] = None
        if content_type == ContentType.EPISODE:
            normalized_season, normalized_episode = _normalize_episode_fields(
                download_data.season,
                download_data.episode,
                download_data.title,
            )
            episode_key = _build_episode_key(
                download_data.series_id,
                download_data.series_name,
                normalized_season,
                normalized_episode,
                download_data.title,
            )
            if episode_key and (episode_key in existing_episode_keys or episode_key in seen_episode_keys):
                continue

        is_scheduled = download_data.scheduled or False

        download = Download(
            stream_id=download_data.stream_id,
            title=download_data.title,
            content_type=content_type,
            series_name=download_data.series_name,
            series_id=download_data.series_id,
            season=normalized_season,
            episode=normalized_episode,
            category_id=download_data.category_id,
            category_name=download_data.category_name,
            poster_url=download_data.poster_url,
            year=download_data.year,
            file_extension=download_data.file_extension,
            status=DownloadStatus.SCHEDULED if is_scheduled else DownloadStatus.PENDING,
            scheduled=is_scheduled,
            scheduled_time=get_next_1am() if is_scheduled else None
        )

        db.add(download)
        created.append(download)
        seen_stream_ids.add(download_data.stream_id)
        if episode_key:
            seen_episode_keys.add(episode_key)

    if created:
        db.commit()
        for download in created:
            db.refresh(download)

    return created


@router.post("/backfill-metadata")
async def backfill_metadata(db: Session = Depends(get_db)):
    """Best-effort metadata backfill for existing downloads."""
    client = get_iptv_client()

    series_categories = await client.get_series_categories()
    movie_categories = await client.get_vod_categories()
    series_category_names = {str(c.get("category_id", "")): c.get("category_name", "") for c in series_categories}
    movie_category_names = {str(c.get("category_id", "")): c.get("category_name", "") for c in movie_categories}

    series_catalog = await client.get_series()
    series_by_name: dict[str, dict] = {}
    for series in series_catalog:
        key = _normalize_text(series.get("name", ""))
        if key:
            series_by_name[key] = series

    touched = 0
    series_updated = 0
    movies_updated = 0

    episode_items = db.query(Download).filter(Download.content_type == ContentType.EPISODE).all()
    for item in episode_items:
        if item.series_id is not None and item.category_id and item.category_name:
            continue

        matched = series_by_name.get(_normalize_text(item.series_name))
        if not matched:
            continue

        item_changed = False
        matched_series_id = matched.get("series_id")
        matched_category_id = str(matched.get("category_id", "")) or None
        matched_category_name = series_category_names.get(matched_category_id or "", "")

        if item.series_id is None and matched_series_id is not None:
            item.series_id = int(matched_series_id)
            item_changed = True
        if not item.category_id and matched_category_id:
            item.category_id = matched_category_id
            item_changed = True
        if not item.category_name and matched_category_name:
            item.category_name = matched_category_name
            item_changed = True

        if item_changed:
            touched += 1
            series_updated += 1

    movie_items = db.query(Download).filter(Download.content_type == ContentType.MOVIE).all()
    for item in movie_items:
        if item.category_id and item.category_name:
            continue

        info = await client.get_movie_info(item.stream_id)
        if not info:
            continue

        movie_data = info.get("movie_data", {})
        info_data = info.get("info", {})
        category_raw = movie_data.get("category_id", "") or info_data.get("category_id", "")
        category_val = str(category_raw) if category_raw else None
        category_name = movie_category_names.get(category_val or "", "")

        item_changed = False
        if not item.category_id and category_val:
            item.category_id = category_val
            item_changed = True
        if not item.category_name and category_name:
            item.category_name = category_name
            item_changed = True

        if item_changed:
            touched += 1
            movies_updated += 1

    if touched > 0:
        db.commit()

    unresolved = db.query(Download).filter(
        or_(Download.category_id.is_(None), Download.category_id == "")
    ).count()

    return {
        "updated": touched,
        "series_updated": series_updated,
        "movies_updated": movies_updated,
        "unresolved_without_category": unresolved
    }
