import os
import re
import shutil
import asyncio
import httpx
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.download import Download, DownloadStatus, ContentType
from app.services.iptv_client import get_iptv_client
from app.database import SessionLocal


class DiskFullError(Exception):
    """Raised when disk space drops below the minimum threshold during download"""
    pass


def sanitize_filename(name: str) -> str:
    """Remove invalid characters from filename"""
    # Replace problematic characters
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    name = re.sub(r'\s+', '_', name)
    return name.strip('_.')


def generate_nfo_movie(title: str, year: str = "", plot: str = "", director: str = "", actors: str = "", genres: str = "", rating: str = "") -> str:
    """Generate NFO content for a movie (Kodi format)"""
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
    <title>{title}</title>
    <year>{year}</year>
    <plot>{plot}</plot>
    <director>{director}</director>
    <genre>{genres}</genre>
    <actor>
        <name>{actors}</name>
    </actor>
    <rating>{rating}</rating>
</movie>
"""


def generate_nfo_episode(title: str, season: int, episode: int, plot: str = "") -> str:
    """Generate NFO content for an episode (Kodi format)"""
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
    <title>{title}</title>
    <season>{season}</season>
    <episode>{episode}</episode>
    <plot>{plot}</plot>
</episodedetails>
"""


def generate_nfo_tvshow(title: str, year: str = "", plot: str = "") -> str:
    """Generate NFO content for a TV show (Kodi format)"""
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
    <title>{title}</title>
    <year>{year}</year>
    <plot>{plot}</plot>
</tvshow>
"""


class DownloadManager:
    """Manages downloads with Kodi-compatible folder structure"""
    
    def __init__(self):
        settings = get_settings()
        self.media_path = Path(settings.media_path)
        self.archive_path = Path(settings.archive_path)
        self.iptv_client = get_iptv_client()
        
        # Create base directories
        self.movies_path = self.media_path / "Peliculas"
        self.series_path = self.media_path / "Series"
        self.movies_path.mkdir(parents=True, exist_ok=True)
        self.series_path.mkdir(parents=True, exist_ok=True)

    def _check_disk_space(self) -> bool:
        """Return True if there is enough free disk space, False otherwise"""
        settings = get_settings()
        min_free_bytes = settings.min_free_space_mb * 1024 * 1024
        try:
            usage = shutil.disk_usage(str(self.media_path))
            return usage.free >= min_free_bytes
        except Exception:
            return True  # If we can't check, don't block downloads
    
    def get_movie_folder_name(self, title: str, year: str = "") -> str:
        """Generate folder name for movie: Title_(Year)"""
        clean_title = sanitize_filename(title)
        if year and f"({year})" not in title:
            return f"{clean_title}_({year})"
        return clean_title
    
    def get_movie_path(self, title: str, year: str = "") -> Path:
        """Get full path for movie folder"""
        folder_name = self.get_movie_folder_name(title, year)
        return self.movies_path / folder_name
    
    def get_series_path(self, series_name: str, season: int) -> Path:
        """Get full path for series season folder"""
        clean_name = sanitize_filename(series_name)
        return self.series_path / clean_name / f"Season {season:02d}"
    
    async def download_poster(self, url: str, save_path: Path) -> bool:
        """Download poster image"""
        if not url:
            return False
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    save_path.write_bytes(response.content)
                    return True
        except Exception:
            pass
        return False
    
    async def download_movie(self, download: Download, db: Session) -> bool:
        """Download a movie with Kodi structure"""
        try:
            # Get movie info
            full_info = await self.iptv_client.get_movie_info(download.stream_id)
            if not full_info:
                self._update_error(download, db, "Movie not found in IPTV")
                return False
            
            info = full_info.get('info', {})
            movie_data = full_info.get('movie_data', {})
            
            extension = movie_data.get('container_extension', 'mp4')
            
            # Extract year from info or try to find it in title if missing
            year = info.get('year') or info.get('releaseDate', '')[:4] or download.year or ''
            if not year and download.title:
                match = re.search(r'\((\d{4})\)', download.title)
                if match:
                    year = match.group(1)
            
            poster_url = movie_data.get('stream_icon') or info.get('movie_image', '')
            
            # Create folder structure
            movie_folder = self.get_movie_path(download.title, year)
            movie_folder.mkdir(parents=True, exist_ok=True)
            
            # File paths
            base_name = self.get_movie_folder_name(download.title, year)
            video_path = movie_folder / f"{base_name}.{extension}"
            nfo_path = movie_folder / f"{base_name}.nfo"
            poster_path = movie_folder / "poster.jpg"
            
            # Download poster
            await self.download_poster(poster_url, poster_path)
            
            # Generate NFO
            nfo_content = generate_nfo_movie(
                download.title, 
                year, 
                info.get('plot', ''),
                info.get('director', ''),
                info.get('actors', ''),
                info.get('genre', ''),
                info.get('rating_5based', info.get('rating', ''))
            )
            nfo_path.write_text(nfo_content, encoding='utf-8')
            
            # Download video
            download_url = self.iptv_client.build_movie_url(download.stream_id, extension)
            success = await self._download_file(download_url, video_path, download, db)
            
            if success:
                download.file_path = str(video_path)
                download.file_extension = extension
                download.status = DownloadStatus.COMPLETED
                download.completed_at = datetime.utcnow()
                download.progress = 100
                db.commit()
                return True
            
            return False

        except DiskFullError:
            raise
        except Exception as e:
            self._update_error(download, db, str(e))
            return False

    async def download_episode(self, download: Download, db: Session) -> bool:
        """Download a series episode with Kodi structure"""
        try:
            extension = download.file_extension or 'mp4'
            
            # Create folder structure
            season_folder = self.get_series_path(download.series_name, download.season)
            season_folder.mkdir(parents=True, exist_ok=True)
            
            # File paths
            episode_name = f"{sanitize_filename(download.series_name)}_S{download.season:02d}E{download.episode:02d}"
            video_path = season_folder / f"{episode_name}.{extension}"
            nfo_path = season_folder / f"{episode_name}.nfo"
            
            # Generate NFO
            nfo_content = generate_nfo_episode(
                download.title,
                download.season,
                download.episode
            )
            nfo_path.write_text(nfo_content, encoding='utf-8')
            
            # Download video
            download_url = self.iptv_client.build_episode_url(download.stream_id, extension)
            success = await self._download_file(download_url, video_path, download, db)
            
            if success:
                download.file_path = str(video_path)
                download.status = DownloadStatus.COMPLETED
                download.completed_at = datetime.utcnow()
                download.progress = 100
                db.commit()
                return True
            
            return False

        except DiskFullError:
            raise
        except Exception as e:
            self._update_error(download, db, str(e))
            return False

    async def _download_file(self, url: str, save_path: Path, download: Download, db: Session) -> bool:
        """Download file with progress tracking"""
        try:
            download.status = DownloadStatus.DOWNLOADING
            db.commit()

            async with httpx.AsyncClient(timeout=None, headers={'User-Agent': 'VLC/3.0.18'}, follow_redirects=True) as client:
                async with client.stream('GET', url) as response:
                    if response.status_code != 200:
                        self._update_error(download, db, f"HTTP {response.status_code}")
                        return False

                    total_size = int(response.headers.get('content-length', 0))
                    downloaded = 0

                    with open(save_path, 'wb') as f:
                        async for chunk in response.aiter_bytes(chunk_size=1024*1024):
                            f.write(chunk)
                            downloaded += len(chunk)

                            # Periodically check status (every ~1MB)
                            if downloaded % (1024*1024) == 0:
                                db.expire(download)
                                db.refresh(download)
                                if download.status != DownloadStatus.DOWNLOADING:
                                    # Status changed (paused, cancelled, error)
                                    return False

                                # Check disk space every ~1MB
                                if not self._check_disk_space():
                                    download.file_size = downloaded
                                    if total_size > 0:
                                        download.progress = int((downloaded / total_size) * 100)
                                    db.commit()
                                    raise DiskFullError(f"Espacio libre por debajo de {get_settings().min_free_space_mb}MB")

                            if total_size > 0:
                                progress = int((downloaded / total_size) * 100)
                                if progress != download.progress:
                                    download.progress = progress
                                    download.file_size = downloaded
                                    db.commit()

                    download.file_size = downloaded
                    db.commit()
                    return True

        except DiskFullError:
            raise
        except Exception as e:
            self._update_error(download, db, str(e))
            return False
    
    def _update_error(self, download: Download, db: Session, error: str):
        """Update download with error status"""
        download.status = DownloadStatus.ERROR
        download.error_message = error
        db.commit()


def _handle_disk_full(current_download: Download, db: Session):
    """Handle disk full: pause current, pause all pending, unschedule all scheduled"""

    # 1. Pause the current download (keep partial file)
    current_download.status = DownloadStatus.PAUSED
    current_download.disk_full_paused = True
    current_download.error_message = "Disco lleno - descarga pausada automaticamente"

    # 2. Pause all PENDING downloads
    pending_downloads = db.query(Download).filter(
        Download.status == DownloadStatus.PENDING
    ).all()
    for dl in pending_downloads:
        dl.status = DownloadStatus.PAUSED
        dl.disk_full_paused = True
        dl.error_message = "Disco lleno - cola detenida"

    # 3. Unschedule and pause all SCHEDULED downloads
    scheduled_downloads = db.query(Download).filter(
        Download.status == DownloadStatus.SCHEDULED
    ).all()
    for dl in scheduled_downloads:
        dl.status = DownloadStatus.PAUSED
        dl.scheduled = False
        dl.scheduled_time = None
        dl.disk_full_paused = True
        dl.error_message = "Disco lleno - programacion cancelada"

    db.commit()

    total = 1 + len(pending_downloads) + len(scheduled_downloads)
    print(f"DISCO LLENO: {total} descargas pausadas (1 activa + {len(pending_downloads)} pendientes + {len(scheduled_downloads)} programadas)")


# Background task for processing downloads
async def process_download_queue():
    """Process pending downloads one by one and check scheduled"""
    manager = DownloadManager()

    print("Download queue processor started")

    while True:
        try:
            db = SessionLocal()
            try:
                # 1. Check for scheduled items that are due
                now = datetime.now(timezone.utc)
                scheduled = db.query(Download).filter(
                    Download.status == DownloadStatus.SCHEDULED,
                    Download.scheduled_time <= now
                ).all()

                if scheduled:
                    print(f"Activating {len(scheduled)} scheduled downloads")
                    for item in scheduled:
                        item.status = DownloadStatus.PENDING
                        item.scheduled = False
                    db.commit()

                # 2. Pre-check disk space before picking up new work
                if not manager._check_disk_space():
                    print("Espacio en disco por debajo del umbral, esperando...")
                    db.close()
                    await asyncio.sleep(30)
                    continue

                # 3. Get next pending download
                pending = db.query(Download).filter(
                    Download.status == DownloadStatus.PENDING
                ).order_by(Download.priority.desc(), Download.created_at.asc()).first()

                if pending:
                    print(f"Starting download: {pending.title}")
                    try:
                        if pending.content_type == ContentType.MOVIE:
                            await manager.download_movie(pending, db)
                        else:
                            await manager.download_episode(pending, db)
                    except DiskFullError as e:
                        print(f"DISCO LLENO: {e}")
                        _handle_disk_full(pending, db)

            finally:
                db.close()

            # Wait before next check
            await asyncio.sleep(5)

        except Exception as e:
            print(f"Error in download queue: {e}")
            await asyncio.sleep(10)


# Singleton instance
_manager: Optional[DownloadManager] = None


def get_download_manager() -> DownloadManager:
    global _manager
    if _manager is None:
        _manager = DownloadManager()
    return _manager
