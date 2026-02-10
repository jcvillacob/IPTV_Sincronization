from sqlalchemy import Column, Integer, String, DateTime, BigInteger, Enum, Boolean
from sqlalchemy.sql import func
import enum

from app.database import Base


class DownloadStatus(str, enum.Enum):
    PENDING = "PENDING"
    DOWNLOADING = "DOWNLOADING"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"
    ARCHIVED = "ARCHIVED"
    SCHEDULED = "SCHEDULED"
    PAUSED = "PAUSED"


class ContentType(str, enum.Enum):
    MOVIE = "MOVIE"
    EPISODE = "EPISODE"


class Download(Base):
    __tablename__ = "downloads"

    id = Column(Integer, primary_key=True, index=True)
    stream_id = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    content_type = Column(Enum(ContentType), nullable=False)
    
    # For series episodes
    series_name = Column(String, nullable=True)
    season = Column(Integer, nullable=True)
    episode = Column(Integer, nullable=True)
    
    # File info
    file_path = Column(String, nullable=True)
    file_extension = Column(String, default="mp4")
    file_size = Column(BigInteger, default=0)
    
    # Status and progress
    status = Column(Enum(DownloadStatus), default=DownloadStatus.PENDING)
    progress = Column(Integer, default=0)  # 0-100
    error_message = Column(String, nullable=True)
    priority = Column(Integer, default=0)
    
    # Scheduled downloads (for 1 AM batch)
    scheduled = Column(Boolean, default=False)
    scheduled_time = Column(DateTime(timezone=True), nullable=True)

    # Disk full protection
    disk_full_paused = Column(Boolean, default=False)
    
    # Metadata
    poster_url = Column(String, nullable=True)
    year = Column(String, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)


class ArchivedFile(Base):
    __tablename__ = "archived_files"

    id = Column(Integer, primary_key=True, index=True)
    download_id = Column(Integer, nullable=False)
    original_path = Column(String, nullable=False)
    archived_path = Column(String, nullable=False)
    archived_at = Column(DateTime(timezone=True), server_default=func.now())
