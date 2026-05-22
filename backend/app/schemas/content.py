from pydantic import BaseModel, field_validator
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


def parse_optional_float(v: Any) -> Optional[float]:
    """Parse optional float, handling empty strings and invalid values"""
    if v is None or v == '' or v == 'N/A':
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


class DownloadStatus(str, Enum):
    PENDING = "PENDING"
    DOWNLOADING = "DOWNLOADING"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"
    ARCHIVED = "ARCHIVED"
    SCHEDULED = "SCHEDULED"
    PAUSED = "PAUSED"


class ContentType(str, Enum):
    MOVIE = "MOVIE"
    EPISODE = "EPISODE"


# Categories
class Category(BaseModel):
    category_id: str
    category_name: str
    parent_id: Optional[int] = None


# Movies
class Movie(BaseModel):
    stream_id: int
    name: str
    stream_icon: Optional[str] = None
    rating: Optional[float] = None
    rating_5based: Optional[float] = None
    category_id: Optional[str] = None
    container_extension: Optional[str] = "mp4"
    year: Optional[str] = None

    @field_validator('rating', 'rating_5based', mode='before')
    @classmethod
    def validate_rating(cls, v):
        return parse_optional_float(v)


# Series
class Series(BaseModel):
    series_id: int
    name: str
    cover: Optional[str] = None
    plot: Optional[str] = None
    cast: Optional[str] = None
    director: Optional[str] = None
    genre: Optional[str] = None
    rating: Optional[str] = None
    category_id: Optional[str] = None


class Episode(BaseModel):
    id: str
    episode_num: int
    title: str
    container_extension: Optional[str] = "mp4"
    info: Optional[dict] = None


class SeasonInfo(BaseModel):
    season_number: int
    episodes: List[Episode]


class SeriesDetail(BaseModel):
    info: Optional[dict] = None
    seasons: List[SeasonInfo] = []


# Downloads
class DownloadCreate(BaseModel):
    stream_id: str
    title: str
    content_type: ContentType
    series_name: Optional[str] = None
    series_id: Optional[int] = None
    season: Optional[int] = None
    episode: Optional[int] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    poster_url: Optional[str] = None
    year: Optional[str] = None
    file_extension: Optional[str] = "mp4"
    scheduled: Optional[bool] = False


class DownloadResponse(BaseModel):
    id: int
    stream_id: str
    title: str
    content_type: ContentType
    series_name: Optional[str] = None
    series_id: Optional[int] = None
    season: Optional[int] = None
    episode: Optional[int] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    file_path: Optional[str] = None
    file_extension: Optional[str] = None
    file_size: int = 0
    status: DownloadStatus
    progress: int = 0
    error_message: Optional[str] = None
    poster_url: Optional[str] = None
    year: Optional[str] = None
    scheduled: bool = False
    scheduled_time: Optional[datetime] = None
    priority: int = 0
    retry_count: int = 0
    next_retry_at: Optional[datetime] = None
    last_attempt_at: Optional[datetime] = None
    last_progress_at: Optional[datetime] = None
    last_error_at: Optional[datetime] = None
    disk_full_paused: bool = False
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Search
class SearchResult(BaseModel):
    movies: List[Movie] = []
    series: List[Series] = []


# Storage
class StorageInfo(BaseModel):
    total_bytes: int
    used_bytes: int
    free_bytes: int
    total_gb: float
    used_gb: float
    free_gb: float
    percent_used: float
