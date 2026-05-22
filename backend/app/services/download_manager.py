import asyncio
import random
import re
import shutil
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import httpx
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models.download import ContentType, Download, DownloadStatus
from app.services.iptv_client import get_iptv_client


class DiskFullError(Exception):
    """Raised when disk space drops below the minimum threshold during download."""


@dataclass
class DownloadAttemptResult:
    success: bool
    retryable: bool = False
    message: str = ""
    interrupted: bool = False


def sanitize_filename(name: str) -> str:
    """Remove invalid characters from filename."""
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    name = re.sub(r'\s+', '_', name)
    return name.strip('_.')


def generate_nfo_movie(
    title: str,
    year: str = "",
    plot: str = "",
    director: str = "",
    actors: str = "",
    genres: str = "",
    rating: str = "",
) -> str:
    """Generate NFO content for a movie (Kodi format)."""
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
    """Generate NFO content for an episode (Kodi format)."""
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
    <title>{title}</title>
    <season>{season}</season>
    <episode>{episode}</episode>
    <plot>{plot}</plot>
</episodedetails>
"""


def generate_nfo_tvshow(title: str, year: str = "", plot: str = "") -> str:
    """Generate NFO content for a TV show (Kodi format)."""
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
    <title>{title}</title>
    <year>{year}</year>
    <plot>{plot}</plot>
</tvshow>
"""


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_aware_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _as_dict(value: object) -> dict:
    return value if isinstance(value, dict) else {}


def _normalize_extension(value: Optional[str], default: str = "mp4") -> str:
    ext = (value or "").strip().lower().lstrip(".")
    if re.fullmatch(r"[a-z0-9]{1,8}", ext):
        return ext
    return default


class DownloadManager:
    """Manages downloads with Kodi-compatible folder structure."""

    def __init__(self):
        settings = get_settings()
        self.settings = settings
        self.media_path = Path(settings.media_path)
        self.archive_path = Path(settings.archive_path)
        self.iptv_client = get_iptv_client()

        # Create base directories
        self.movies_path = self.media_path / "Peliculas"
        self.series_path = self.media_path / "Series"
        self.movies_path.mkdir(parents=True, exist_ok=True)
        self.series_path.mkdir(parents=True, exist_ok=True)

        timeout = httpx.Timeout(
            timeout=float(settings.download_read_timeout_seconds),
            connect=float(settings.download_connect_timeout_seconds),
            read=float(settings.download_read_timeout_seconds),
            write=float(settings.download_read_timeout_seconds),
            pool=float(settings.download_connect_timeout_seconds),
        )
        limits = httpx.Limits(
            max_connections=max(settings.max_concurrent_downloads * 8, 20),
            max_keepalive_connections=max(settings.max_concurrent_downloads * 4, 10),
        )
        self.http_client = httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": "VLC/3.0.18"},
            limits=limits,
        )

    async def close(self):
        await self.http_client.aclose()

    def _check_disk_space(self) -> bool:
        """Return True if there is enough free disk space, False otherwise."""
        min_free_bytes = self.settings.min_free_space_mb * 1024 * 1024
        try:
            usage = shutil.disk_usage(str(self.media_path))
            return usage.free >= min_free_bytes
        except Exception:
            return True

    def _is_retryable_exception(self, error: Exception) -> bool:
        message = str(error).lower()
        return (
            isinstance(
                error,
                (
                    httpx.ReadError,
                    httpx.ReadTimeout,
                    httpx.ConnectError,
                    httpx.ConnectTimeout,
                    httpx.WriteError,
                    httpx.WriteTimeout,
                    httpx.RemoteProtocolError,
                    httpx.PoolTimeout,
                    httpx.RequestError,
                ),
            )
            or "incomplete" in message
            or "peer closed connection" in message
            or "connection reset" in message
            or "timed out" in message
            or "temporarily unavailable" in message
        )

    def _next_retry_delay_seconds(self, retry_count: int) -> int:
        base = max(1, self.settings.download_retry_base_seconds)
        max_delay = max(base, self.settings.download_retry_max_seconds)
        backoff = min(base * (2 ** max(retry_count - 1, 0)), max_delay)
        jitter = random.randint(0, 3)
        return int(backoff + jitter)

    def mark_non_retryable_error(self, download: Download, db: Session, error: str, worker_id: int):
        now = _utcnow()
        download.status = DownloadStatus.ERROR
        download.error_message = error[:500]
        download.last_error_at = now
        download.next_retry_at = None
        db.commit()
        print(
            f"download_failure worker={worker_id} id={download.id} "
            f"retryable=false status=ERROR error={download.error_message}"
        )

    def schedule_retry_or_pause(self, download: Download, db: Session, error: str, worker_id: int):
        now = _utcnow()
        download.retry_count = (download.retry_count or 0) + 1
        download.last_error_at = now
        download.disk_full_paused = False

        max_retries = self.settings.download_max_auto_retries
        if download.retry_count > max_retries:
            download.status = DownloadStatus.PAUSED
            download.next_retry_at = None
            download.error_message = (
                f"Reintentos agotados ({max_retries}). Ultimo error: {error}"
            )[:500]
            db.commit()
            print(
                f"download_retry_exhausted worker={worker_id} id={download.id} "
                f"retry_count={download.retry_count}"
            )
            return

        delay_seconds = self._next_retry_delay_seconds(download.retry_count)
        download.status = DownloadStatus.PENDING
        download.next_retry_at = now + timedelta(seconds=delay_seconds)
        download.error_message = (
            "Error transitorio: "
            f"{error}. Reintento {download.retry_count}/{max_retries} en {delay_seconds}s."
        )[:500]
        db.commit()
        print(
            f"download_retry_scheduled worker={worker_id} id={download.id} "
            f"retry_count={download.retry_count} delay_s={delay_seconds}"
        )

    def get_movie_folder_name(self, title: str, year: str = "") -> str:
        clean_title = sanitize_filename(title)
        if year and f"({year})" not in title:
            return f"{clean_title}_({year})"
        return clean_title

    def get_movie_path(self, title: str, year: str = "") -> Path:
        folder_name = self.get_movie_folder_name(title, year)
        return self.movies_path / folder_name

    def get_series_path(self, series_name: str, season: int) -> Path:
        clean_name = sanitize_filename(series_name)
        return self.series_path / clean_name / f"Season {season:02d}"

    async def download_poster(self, url: str, save_path: Path) -> bool:
        if not url:
            return False
        try:
            response = await self.http_client.get(url)
            if response.status_code == 200:
                save_path.write_bytes(response.content)
                return True
        except Exception:
            return False
        return False

    async def download_movie(self, download: Download, db: Session) -> DownloadAttemptResult:
        try:
            full_info = await self.iptv_client.get_movie_info(download.stream_id)
            info = _as_dict(_as_dict(full_info).get("info"))
            movie_data = _as_dict(_as_dict(full_info).get("movie_data"))
            extension = _normalize_extension(
                str(movie_data.get("container_extension") or download.file_extension or "mp4")
            )

            if not info and not movie_data:
                print(f"download_movie_metadata_missing id={download.id} stream_id={download.stream_id}")

            release_date = str(info.get("releaseDate") or info.get("releasedate") or "")
            year = str(info.get("year") or release_date[:4] or download.year or "")
            if not year and download.title:
                match = re.search(r"\((\d{4})\)", download.title)
                if match:
                    year = match.group(1)

            poster_url = str(
                movie_data.get("stream_icon")
                or info.get("movie_image")
                or download.poster_url
                or ""
            )

            movie_folder = self.get_movie_path(download.title, year)
            movie_folder.mkdir(parents=True, exist_ok=True)

            base_name = self.get_movie_folder_name(download.title, year)
            video_path = movie_folder / f"{base_name}.{extension}"
            nfo_path = movie_folder / f"{base_name}.nfo"
            poster_path = movie_folder / "poster.jpg"

            await self.download_poster(poster_url, poster_path)

            nfo_content = generate_nfo_movie(
                download.title,
                year,
                info.get("plot", ""),
                info.get("director", ""),
                info.get("actors", ""),
                info.get("genre", ""),
                str(info.get("rating_5based", info.get("rating", ""))),
            )
            nfo_path.write_text(nfo_content, encoding="utf-8")

            download_url = self.iptv_client.build_movie_url(download.stream_id, extension)
            result = await self._download_file(download_url, video_path, download, db)
            if not result.success:
                return result

            download.file_path = str(video_path)
            download.file_extension = extension
            download.status = DownloadStatus.COMPLETED
            download.completed_at = _utcnow()
            download.progress = 100
            download.error_message = None
            download.next_retry_at = None
            download.disk_full_paused = False
            db.commit()
            return DownloadAttemptResult(success=True)

        except DiskFullError:
            raise
        except Exception as error:
            return DownloadAttemptResult(
                success=False,
                retryable=self._is_retryable_exception(error),
                message=str(error),
            )

    async def download_episode(self, download: Download, db: Session) -> DownloadAttemptResult:
        try:
            extension = download.file_extension or "mp4"
            season = int(download.season or 1)
            episode = int(download.episode or 0)
            series_name = download.series_name or "Serie"

            season_folder = self.get_series_path(series_name, season)
            season_folder.mkdir(parents=True, exist_ok=True)

            episode_name = f"{sanitize_filename(series_name)}_S{season:02d}E{episode:02d}"
            video_path = season_folder / f"{episode_name}.{extension}"
            nfo_path = season_folder / f"{episode_name}.nfo"

            nfo_content = generate_nfo_episode(download.title, season, episode)
            nfo_path.write_text(nfo_content, encoding="utf-8")

            download_url = self.iptv_client.build_episode_url(download.stream_id, extension)
            result = await self._download_file(download_url, video_path, download, db)
            if not result.success:
                return result

            download.file_path = str(video_path)
            download.file_extension = extension
            download.status = DownloadStatus.COMPLETED
            download.completed_at = _utcnow()
            download.progress = 100
            download.error_message = None
            download.next_retry_at = None
            download.disk_full_paused = False
            db.commit()
            return DownloadAttemptResult(success=True)

        except DiskFullError:
            raise
        except Exception as error:
            return DownloadAttemptResult(
                success=False,
                retryable=self._is_retryable_exception(error),
                message=str(error),
            )

    async def _download_file(
        self,
        url: str,
        save_path: Path,
        download: Download,
        db: Session,
    ) -> DownloadAttemptResult:
        """Single download attempt with progress tracking."""
        try:
            existing_size = save_path.stat().st_size if save_path.exists() else 0
            commit_interval = max(1.0, float(self.settings.download_progress_commit_interval_seconds))
            last_commit_monotonic = time.monotonic()
            last_control_check = last_commit_monotonic
            last_committed_progress = int(download.progress or 0)
            downloaded = existing_size
            total_size = 0
            reconnects_in_attempt = 0
            max_reconnects_in_attempt = 8

            while True:
                try:
                    db.expire(download)
                    db.refresh(download)
                    if download.status != DownloadStatus.DOWNLOADING:
                        return DownloadAttemptResult(
                            success=False,
                            retryable=False,
                            message="Download paused or status changed",
                            interrupted=True,
                        )

                    request_headers = {"User-Agent": "VLC/3.0.18"}
                    if downloaded > 0:
                        request_headers["Range"] = f"bytes={downloaded}-"

                    async with self.http_client.stream("GET", url, headers=request_headers) as response:
                        if response.status_code == 416 and downloaded > 0:
                            # Local file size is ahead of what the origin accepts for resume.
                            # This commonly happens when the episode is already fully present
                            # on disk under the same target filename. Restart from byte 0.
                            downloaded = 0
                            total_size = 0
                            last_committed_progress = 0
                            try:
                                save_path.unlink()
                            except FileNotFoundError:
                                pass
                            continue

                        if response.status_code not in (200, 206):
                            # 401/403 from the IPTV origin have proven persistent for specific streams.
                            # Treat them as terminal failures so the queue does not burn through retries
                            # on content the provider is actively denying.
                            retryable = response.status_code in (408, 429) or response.status_code >= 500
                            return DownloadAttemptResult(
                                success=False,
                                retryable=retryable,
                                message=f"HTTP {response.status_code}",
                            )

                        content_type = (response.headers.get("content-type") or "").split(";")[0].strip().lower()
                        if content_type.startswith("text/") or content_type in {"application/json", "application/xml"}:
                            return DownloadAttemptResult(
                                success=False,
                                retryable=False,
                                message=f"Invalid media response content-type: {content_type}",
                            )

                        if response.status_code == 206:
                            range_total = response.headers.get("content-range", "").split("/")[-1]
                            if range_total.isdigit():
                                total_size = int(range_total)
                            else:
                                content_length = response.headers.get("content-length", "0")
                                if content_length.isdigit():
                                    total_size = downloaded + int(content_length)
                            write_mode = "ab" if downloaded > 0 else "wb"
                        else:
                            # Origin ignored Range; restart from byte 0 to avoid file corruption.
                            if downloaded > 0:
                                downloaded = 0
                                last_committed_progress = 0
                                try:
                                    save_path.unlink()
                                except FileNotFoundError:
                                    pass
                            content_length = response.headers.get("content-length", "0")
                            total_size = int(content_length) if content_length.isdigit() else 0
                            write_mode = "wb"

                        with open(save_path, write_mode) as file_obj:
                            async for chunk in response.aiter_bytes(chunk_size=1024 * 1024):
                                if not chunk:
                                    continue

                                file_obj.write(chunk)
                                downloaded += len(chunk)
                                now_monotonic = time.monotonic()

                                if (now_monotonic - last_control_check) >= 1.0:
                                    db.expire(download)
                                    db.refresh(download)
                                    if download.status != DownloadStatus.DOWNLOADING:
                                        return DownloadAttemptResult(
                                            success=False,
                                            retryable=False,
                                            message="Download paused or status changed",
                                            interrupted=True,
                                        )

                                    if not self._check_disk_space():
                                        download.file_size = downloaded
                                        if total_size > 0:
                                            download.progress = min(100, int((downloaded / total_size) * 100))
                                        download.last_progress_at = _utcnow()
                                        db.commit()
                                        raise DiskFullError(
                                            f"Espacio libre por debajo de {self.settings.min_free_space_mb}MB"
                                        )

                                    last_control_check = now_monotonic

                                progress = last_committed_progress
                                if total_size > 0:
                                    progress = min(100, int((downloaded / total_size) * 100))

                                should_commit = False
                                if total_size > 0 and progress >= (last_committed_progress + 1):
                                    should_commit = True
                                if (now_monotonic - last_commit_monotonic) >= commit_interval:
                                    should_commit = True

                                if should_commit:
                                    download.file_size = downloaded
                                    if total_size > 0:
                                        download.progress = progress
                                        last_committed_progress = progress
                                    download.last_progress_at = _utcnow()
                                    db.commit()
                                    last_commit_monotonic = now_monotonic

                    if total_size > 0 and downloaded < total_size:
                        raise RuntimeError(
                            f"Incomplete download: received {downloaded} bytes, expected {total_size}"
                        )
                    if downloaded == 0:
                        raise RuntimeError("Empty response body from stream source")

                    break

                except DiskFullError:
                    raise
                except Exception as error:
                    if not self._is_retryable_exception(error):
                        return DownloadAttemptResult(
                            success=False,
                            retryable=False,
                            message=str(error),
                        )

                    reconnects_in_attempt += 1
                    if reconnects_in_attempt > max_reconnects_in_attempt:
                        return DownloadAttemptResult(
                            success=False,
                            retryable=True,
                            message=(
                                f"{error} (agotados reintentos internos de stream: "
                                f"{max_reconnects_in_attempt})"
                            ),
                        )

                    download.file_size = downloaded
                    if total_size > 0:
                        progress = min(100, int((downloaded / total_size) * 100))
                        download.progress = progress
                        last_committed_progress = progress
                    download.last_progress_at = _utcnow()
                    db.commit()

                    sleep_seconds = min(2 * reconnects_in_attempt, 15)
                    print(
                        f"download_stream_reconnect id={download.id} "
                        f"attempt={reconnects_in_attempt} delay_s={sleep_seconds} "
                        f"downloaded={downloaded}"
                    )
                    await asyncio.sleep(sleep_seconds)

            download.file_size = downloaded
            if total_size > 0:
                download.progress = min(100, int((downloaded / total_size) * 100))
            download.last_progress_at = _utcnow()
            db.commit()
            return DownloadAttemptResult(success=True)

        except DiskFullError:
            raise
        except Exception as error:
            return DownloadAttemptResult(
                success=False,
                retryable=self._is_retryable_exception(error),
                message=str(error),
            )


def _handle_disk_full(current_download: Download, db: Session):
    """Pause all active/pending/scheduled downloads on disk-full events."""

    candidates = db.query(Download).filter(
        Download.status.in_([
            DownloadStatus.DOWNLOADING,
            DownloadStatus.PENDING,
            DownloadStatus.SCHEDULED,
        ])
    ).all()

    total = 0
    for item in candidates:
        previous_status = item.status
        item.status = DownloadStatus.PAUSED
        item.disk_full_paused = True
        item.next_retry_at = None
        if previous_status == DownloadStatus.SCHEDULED:
            item.scheduled = False
            item.scheduled_time = None
            item.error_message = "Disco lleno - programacion cancelada"
        elif item.id == current_download.id:
            item.error_message = "Disco lleno - descarga pausada automaticamente"
        else:
            item.error_message = "Disco lleno - cola detenida"
        total += 1

    db.commit()
    print(f"disk_full_event paused_downloads={total}")


def _recover_inflight_downloads():
    db = SessionLocal()
    try:
        inflight = db.query(Download).filter(Download.status == DownloadStatus.DOWNLOADING).all()
        if not inflight:
            return

        now = _utcnow()
        for item in inflight:
            item.status = DownloadStatus.PENDING
            item.next_retry_at = None
            item.last_error_at = now
            item.error_message = "Recuperado despues de reinicio del servicio"
        db.commit()

        print(f"startup_recovery recovered={len(inflight)}")
    finally:
        db.close()


def _activate_scheduled_downloads() -> int:
    db = SessionLocal()
    try:
        now = _utcnow()
        scheduled = db.query(Download).filter(
            Download.status == DownloadStatus.SCHEDULED,
            Download.scheduled_time <= now,
        ).all()

        if not scheduled:
            return 0

        for item in scheduled:
            item.status = DownloadStatus.PENDING
            item.scheduled = False
            item.next_retry_at = None

        db.commit()
        return len(scheduled)
    finally:
        db.close()


def _claim_next_pending_download(worker_id: int) -> Optional[int]:
    db = SessionLocal()
    try:
        now = _utcnow()
        pending = (
            db.query(Download)
            .filter(
                Download.status == DownloadStatus.PENDING,
                or_(Download.next_retry_at.is_(None), Download.next_retry_at <= now),
            )
            .order_by(Download.priority.desc(), Download.created_at.asc())
            .with_for_update(skip_locked=True)
            .first()
        )

        if not pending:
            return None

        pending.status = DownloadStatus.DOWNLOADING
        pending.last_attempt_at = now
        pending.last_progress_at = now
        pending.disk_full_paused = False
        pending.next_retry_at = None
        pending.error_message = None
        db.commit()
        download_id = pending.id

        print(f"download_claim worker={worker_id} id={download_id} retry_count={pending.retry_count or 0}")
        return download_id
    finally:
        db.close()


def _recover_stalled_downloads(manager: DownloadManager) -> int:
    db = SessionLocal()
    recovered = 0
    try:
        now = _utcnow()
        threshold = timedelta(seconds=max(1, manager.settings.download_stall_timeout_seconds))

        downloading_items = db.query(Download).filter(
            Download.status == DownloadStatus.DOWNLOADING
        ).all()

        for item in downloading_items:
            mark = _to_aware_utc(item.last_progress_at) or _to_aware_utc(item.last_attempt_at) or _to_aware_utc(item.created_at)
            if mark is None:
                continue
            if (now - mark) < threshold:
                continue

            manager.schedule_retry_or_pause(
                item,
                db,
                f"Sin progreso por mas de {manager.settings.download_stall_timeout_seconds}s",
                worker_id=0,
            )
            recovered += 1
            print(f"stalled_detected id={item.id} stalled_seconds={(now - mark).seconds}")

        return recovered
    finally:
        db.close()


async def _run_download_attempt(worker_id: int, manager: DownloadManager, download_id: int):
    db = SessionLocal()
    try:
        download = db.query(Download).filter(Download.id == download_id).first()
        if not download:
            return

        if download.status != DownloadStatus.DOWNLOADING:
            return

        attempt = (download.retry_count or 0) + 1
        print(
            f"download_start worker={worker_id} id={download.id} "
            f"attempt={attempt} title={download.title}"
        )

        try:
            if download.content_type == ContentType.MOVIE:
                result = await manager.download_movie(download, db)
            else:
                result = await manager.download_episode(download, db)
        except DiskFullError as error:
            print(f"disk_full worker={worker_id} id={download.id} error={error}")
            _handle_disk_full(download, db)
            return

        db.expire(download)
        db.refresh(download)

        if result.success:
            print(
                f"download_completed worker={worker_id} id={download.id} "
                f"size={download.file_size}"
            )
            return

        if result.interrupted:
            print(f"download_interrupted worker={worker_id} id={download.id}")
            return

        if result.retryable:
            manager.schedule_retry_or_pause(download, db, result.message or "Retryable download failure", worker_id)
            return

        manager.mark_non_retryable_error(download, db, result.message or "Download failed", worker_id)

    finally:
        db.close()


async def _worker_loop(worker_id: int, manager: DownloadManager):
    while True:
        try:
            if not manager._check_disk_space():
                await asyncio.sleep(5)
                continue

            download_id = _claim_next_pending_download(worker_id)
            if download_id is None:
                await asyncio.sleep(1)
                continue

            await _run_download_attempt(worker_id, manager, download_id)

        except asyncio.CancelledError:
            raise
        except Exception as error:
            print(f"worker_error worker={worker_id} error={error}")
            await asyncio.sleep(2)


async def _scheduled_activator_loop():
    while True:
        try:
            activated = _activate_scheduled_downloads()
            if activated > 0:
                print(f"scheduled_activated count={activated}")
        except asyncio.CancelledError:
            raise
        except Exception as error:
            print(f"scheduled_activator_error error={error}")

        await asyncio.sleep(15)


async def _stalled_recovery_loop(manager: DownloadManager):
    interval_seconds = max(5, manager.settings.download_stall_timeout_seconds // 3)
    while True:
        try:
            recovered = _recover_stalled_downloads(manager)
            if recovered > 0:
                print(f"stalled_recovered count={recovered}")
        except asyncio.CancelledError:
            raise
        except Exception as error:
            print(f"stalled_recovery_error error={error}")

        await asyncio.sleep(interval_seconds)


async def process_download_queue():
    """Concurrent queue processor with retry and stalled-download recovery."""
    manager = DownloadManager()
    _recover_inflight_downloads()

    worker_count = max(1, manager.settings.max_concurrent_downloads)
    print(f"download_queue_started active_workers={worker_count}")

    tasks = [
        asyncio.create_task(_scheduled_activator_loop(), name="downloads-scheduled-activator"),
        asyncio.create_task(_stalled_recovery_loop(manager), name="downloads-stalled-recovery"),
    ]
    for worker_id in range(1, worker_count + 1):
        tasks.append(
            asyncio.create_task(
                _worker_loop(worker_id, manager),
                name=f"downloads-worker-{worker_id}",
            )
        )

    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await manager.close()
        raise
    except Exception as error:
        print(f"download_queue_error error={error}")
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await manager.close()
        raise


# Singleton instance
_manager: Optional[DownloadManager] = None


def get_download_manager() -> DownloadManager:
    global _manager
    if _manager is None:
        _manager = DownloadManager()
    return _manager
