import asyncio
import time
import httpx
from typing import Optional
from app.config import get_settings


class IPTVClient:
    """Client for IPTV Xtream Codes API"""
    
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.iptv_base_url
        self.user = settings.iptv_user
        self.password = settings.iptv_pass
        self.headers = {'User-Agent': 'VLC/3.0.18'}
        self.cache_ttl_seconds = 600
        self.timeout = httpx.Timeout(
            timeout=30.0,
            connect=10.0,
            read=30.0,
            write=30.0,
            pool=10.0
        )
        self._http = httpx.AsyncClient(
            headers=self.headers,
            timeout=self.timeout,
            follow_redirects=True
        )
        self._vod_cache: list = []
        self._vod_cache_at: float = 0
        self._series_cache: list = []
        self._series_cache_at: float = 0
        self._cache_lock = asyncio.Lock()
    
    def _build_api_url(self, action: str, params: str = "") -> str:
        return f"{self.base_url}/player_api.php?username={self.user}&password={self.password}&action={action}{params}"
    
    async def _request(self, action: str, params: str = "") -> list | dict:
        url = self._build_api_url(action, params)
        try:
            response = await self._http.get(url)
            if response.status_code == 200:
                return response.json()
        except (httpx.RequestError, ValueError):
            return []
        return []

    async def close(self):
        await self._http.aclose()

    def _cache_valid(self, timestamp: float) -> bool:
        return timestamp > 0 and (time.time() - timestamp) < self.cache_ttl_seconds

    async def _get_cached_vod_streams(self) -> list:
        if self._cache_valid(self._vod_cache_at):
            return self._vod_cache

        async with self._cache_lock:
            if self._cache_valid(self._vod_cache_at):
                return self._vod_cache
            data = await self._request("get_vod_streams")
            self._vod_cache = data if isinstance(data, list) else []
            self._vod_cache_at = time.time()
            return self._vod_cache

    async def _get_cached_series(self) -> list:
        if self._cache_valid(self._series_cache_at):
            return self._series_cache

        async with self._cache_lock:
            if self._cache_valid(self._series_cache_at):
                return self._series_cache
            data = await self._request("get_series")
            self._series_cache = data if isinstance(data, list) else []
            self._series_cache_at = time.time()
            return self._series_cache
    
    # Categories
    async def get_vod_categories(self) -> list:
        """Get all movie categories"""
        return await self._request("get_vod_categories")
    
    async def get_series_categories(self) -> list:
        """Get all series categories"""
        return await self._request("get_series_categories")
    
    # Content listing
    async def get_vod_streams(self, category_id: Optional[str] = None) -> list:
        """Get movies, optionally filtered by category"""
        if category_id is None:
            return await self._get_cached_vod_streams()
        if self._cache_valid(self._vod_cache_at):
            return [
                m for m in self._vod_cache
                if str(m.get("category_id", "")) == str(category_id)
            ]
        params = f"&category_id={category_id}" if category_id else ""
        return await self._request("get_vod_streams", params)
    
    async def get_series(self, category_id: Optional[str] = None) -> list:
        """Get series, optionally filtered by category"""
        if category_id is None:
            return await self._get_cached_series()
        if self._cache_valid(self._series_cache_at):
            return [
                s for s in self._series_cache
                if str(s.get("category_id", "")) == str(category_id)
            ]
        params = f"&category_id={category_id}" if category_id else ""
        return await self._request("get_series", params)
    
    async def get_series_info(self, series_id: str) -> dict:
        """Get series info with seasons and episodes"""
        params = f"&series_id={series_id}"
        return await self._request("get_series_info", params)
    
    # Search
    async def search(self, query: str) -> dict:
        """Search movies and series by title"""
        query_lower = query.lower()
        
        # Search in movies
        movies = await self.get_vod_streams()
        matching_movies = [
            m for m in movies 
            if query_lower in m.get('name', '').lower()
        ]
        
        # Search in series
        series = await self.get_series()
        matching_series = [
            s for s in series 
            if query_lower in s.get('name', '').lower()
        ]
        
        return {
            "movies": matching_movies[:50],  # Limit results
            "series": matching_series[:50]
        }
    
    # Movie info
    async def get_movie_info(self, stream_id: str) -> dict:
        """Get detailed info for a specific movie using get_vod_info"""
        params = f"&vod_id={stream_id}"
        return await self._request("get_vod_info", params)
    
    def build_movie_url(self, stream_id: str, extension: str = "mp4") -> str:
        """Build direct download URL for a movie"""
        return f"{self.base_url}/movie/{self.user}/{self.password}/{stream_id}.{extension}"
    
    def build_episode_url(self, episode_id: str, extension: str = "mp4") -> str:
        """Build direct download URL for a series episode"""
        return f"{self.base_url}/series/{self.user}/{self.password}/{episode_id}.{extension}"


# Singleton instance
_client: Optional[IPTVClient] = None


def get_iptv_client() -> IPTVClient:
    global _client
    if _client is None:
        _client = IPTVClient()
    return _client
