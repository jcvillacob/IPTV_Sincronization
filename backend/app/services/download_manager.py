import os
import re
import asyncio
import httpx
from pathlib import Path
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.download import Download, DownloadStatus, ContentType
from app.services.iptv_client import get_iptv_client


def sanitize_filename(name: str) -> str:
    """Remove invalid characters from filename"""
    # Replace problematic characters
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    name = re.sub(r'\s+', '_', name)
    return name.strip('_.')


def generate_nfo_movie(title: str, year: str = "", plot: str = "") -> str:
    """Generate NFO content for a movie (Kodi format)"""
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
    <title>{title}</title>
    <year>{year}</year>
    <plot>{plot}</plot>
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
    
    def get_movie_folder_name(self, title: str, year: str = "") -> str:
        """Generate folder name for movie: Title_(Year)"""
        clean_title = sanitize_filename(title)
        if year:
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
            async with httpx.AsyncClient(timeout=30.0) as client:
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
            movie_info = await self.iptv_client.get_movie_info(download.stream_id)
            if not movie_info:
                self._update_error(download, db, "Movie not found in IPTV")
                return False
            
            extension = movie_info.get('container_extension', 'mp4')
            year = movie_info.get('year', download.year or '')
            poster_url = movie_info.get('stream_icon', '')
            
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
                movie_info.get('plot', '')
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
            
        except Exception as e:
            self._update_error(download, db, str(e))
            return False
    
    async def _download_file(self, url: str, save_path: Path, download: Download, db: Session) -> bool:
        """Download file with progress tracking"""
        try:
            download.status = DownloadStatus.DOWNLOADING
            db.commit()
            
            async with httpx.AsyncClient(timeout=None, headers={'User-Agent': 'VLC/3.0.18'}) as client:
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
                            
                            if total_size > 0:
                                progress = int((downloaded / total_size) * 100)
                                if progress != download.progress:
                                    download.progress = progress
                                    download.file_size = downloaded
                                    db.commit()
                    
                    download.file_size = downloaded
                    db.commit()
                    return True
                    
        except Exception as e:
            self._update_error(download, db, str(e))
            return False
    
    def _update_error(self, download: Download, db: Session, error: str):
        """Update download with error status"""
        download.status = DownloadStatus.ERROR
        download.error_message = error
        db.commit()


# Background task for processing downloads
async def process_download_queue(db: Session):
    """Process pending downloads one by one"""
    manager = DownloadManager()
    
    while True:
        # Get next pending download
        pending = db.query(Download).filter(
            Download.status == DownloadStatus.PENDING
        ).first()
        
        if pending:
            if pending.content_type == ContentType.MOVIE:
                await manager.download_movie(pending, db)
            else:
                await manager.download_episode(pending, db)
        else:
            # No pending downloads, wait 5 seconds
            await asyncio.sleep(5)


# Singleton instance
_manager: Optional[DownloadManager] = None


def get_download_manager() -> DownloadManager:
    global _manager
    if _manager is None:
        _manager = DownloadManager()
    return _manager
