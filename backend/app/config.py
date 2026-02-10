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
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
