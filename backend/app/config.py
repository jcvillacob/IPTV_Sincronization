from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:postgres@db:5432/iptv_sync"
    
    # IPTV API
    iptv_base_url: str = "http://redworld.pro:8880"
    iptv_user: str = ""
    iptv_pass: str = ""
    
    # Paths
    media_path: str = "/media/usb/Compartida_Kodi"
    archive_path: str = "/archive"

    # Disk space protection
    min_free_space_mb: int = 500

    # Scheduling timezone (e.g. America/Mexico_City, America/Bogota, UTC)
    schedule_timezone: str = "UTC"

    # Download worker behavior
    max_concurrent_downloads: int = 3
    download_stall_timeout_seconds: int = 180
    download_max_auto_retries: int = 6
    download_retry_base_seconds: int = 5
    download_retry_max_seconds: int = 120
    download_connect_timeout_seconds: int = 15
    download_read_timeout_seconds: int = 45
    download_progress_commit_interval_seconds: int = 2
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
