import ipaddress
import re
from urllib.parse import quote, urlparse

import httpx
from fastapi import APIRouter, Query, Response
from typing import List, Optional
from app.schemas import Movie, Series, SeasonInfo, Episode, SearchResult
from app.services import get_iptv_client

router = APIRouter()

_PLACEHOLDER_SVG = (
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300">'
    b'<rect fill="#0f0f19" width="200" height="300"/>'
    b'<text x="100" y="155" text-anchor="middle" fill="#64748b"'
    b' font-family="system-ui" font-size="13">Sin imagen</text>'
    b'</svg>'
)

_EPISODE_CODE_RE = re.compile(r"[Ss](\d{1,3})\s*[-_. ]?[Ee](\d{1,4})")


def _placeholder_response() -> Response:
    return Response(
        content=_PLACEHOLDER_SVG,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )


def _is_disallowed_image_host(hostname: Optional[str]) -> bool:
    if not hostname:
        return True

    host = hostname.strip().lower()
    blocked_hosts = {"localhost", "backend", "db", "0.0.0.0"}
    if host in blocked_hosts or host.endswith(".local"):
        return True

    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False

    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _to_proxy_image_url(value: Optional[str]) -> Optional[str]:
    raw = (value or "").strip()
    if not raw:
        return None
    if raw.startswith("/api/content/image?url="):
        return raw
    if raw.lower().startswith(("http://", "https://")):
        return f"/api/content/image?url={quote(raw, safe='')}"
    return raw


def _to_positive_int(value: object) -> Optional[int]:
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _extract_episode_numbers(raw_episode: dict, season_hint: int) -> tuple[int, int]:
    title = str(raw_episode.get("title", "") or "")
    info = raw_episode.get("info") if isinstance(raw_episode.get("info"), dict) else {}

    parsed_season: Optional[int] = None
    parsed_episode: Optional[int] = None
    match = _EPISODE_CODE_RE.search(title)
    if match:
        parsed_season = _to_positive_int(match.group(1))
        parsed_episode = _to_positive_int(match.group(2))

    info_season = _to_positive_int(info.get("season"))
    info_episode = _to_positive_int(info.get("episode_num"))
    raw_episode_num = _to_positive_int(raw_episode.get("episode_num"))

    canonical_season = parsed_season or info_season or season_hint or 1
    canonical_episode = parsed_episode or info_episode or raw_episode_num or 0
    return canonical_season, canonical_episode


def _episode_dedupe_key(raw_episode: dict, season_number: int, episode_number: int) -> str:
    info = raw_episode.get("info") if isinstance(raw_episode.get("info"), dict) else {}
    tmdb_id = _to_positive_int(info.get("tmdb_id"))
    if season_number > 0 and episode_number > 0:
        return f"s{season_number:04d}e{episode_number:04d}"
    if tmdb_id:
        return f"tmdb:{tmdb_id}"
    title_key = " ".join(str(raw_episode.get("title", "") or "").strip().lower().split())
    if title_key:
        return f"title:{title_key}"
    return f"id:{str(raw_episode.get('id', '')).strip()}"


def _episode_quality_score(raw_episode: dict) -> tuple[int, int, int]:
    info = raw_episode.get("info") if isinstance(raw_episode.get("info"), dict) else {}
    video = info.get("video") if isinstance(info.get("video"), dict) else {}

    width = _to_positive_int(video.get("width")) or 0
    height = _to_positive_int(video.get("height")) or 0
    bitrate = _to_positive_int(info.get("bitrate")) or 0
    duration = _to_positive_int(info.get("duration_secs")) or 0

    return (width * height, bitrate, duration)


@router.get("/movies", response_model=List[Movie])
async def get_movies(category_id: Optional[str] = Query(None)):
    """Get movies, optionally filtered by category"""
    client = get_iptv_client()
    movies = await client.get_vod_streams(category_id)
    return [
        Movie(
            stream_id=m.get('stream_id', 0),
            name=m.get('name', ''),
            stream_icon=_to_proxy_image_url(m.get('stream_icon')),
            rating=m.get('rating'),
            rating_5based=m.get('rating_5based'),
            category_id=str(m.get('category_id', '')),
            container_extension=m.get('container_extension', 'mp4'),
            year=m.get('year')
        )
        for m in movies
    ]


@router.get("/series", response_model=List[Series])
async def get_series(category_id: Optional[str] = Query(None)):
    """Get series, optionally filtered by category"""
    client = get_iptv_client()
    series_list = await client.get_series(category_id)
    return [
        Series(
            series_id=s.get('series_id', 0),
            name=s.get('name', ''),
            cover=_to_proxy_image_url(s.get('cover')),
            plot=s.get('plot'),
            cast=s.get('cast'),
            director=s.get('director'),
            genre=s.get('genre'),
            rating=s.get('rating'),
            category_id=str(s.get('category_id', ''))
        )
        for s in series_list
    ]


@router.get("/series/{series_id}/info")
async def get_series_info(series_id: str):
    """Get series info with seasons and episodes"""
    client = get_iptv_client()
    data = await client.get_series_info(series_id)

    episodes_data = data.get("episodes", {})
    if not isinstance(episodes_data, dict):
        return {"info": data.get("info", {}), "seasons": []}

    # Some providers return multiple stream variants for the same episode.
    # We canonicalize SxxExx and keep the best-quality candidate per episode.
    season_buckets: dict[int, dict[str, tuple[tuple[int, int, int], Episode]]] = {}

    for season_num, episodes in episodes_data.items():
        season_hint = _to_positive_int(season_num) or 1
        if not isinstance(episodes, list):
            continue

        for raw_episode in episodes:
            if not isinstance(raw_episode, dict):
                continue

            canonical_season, canonical_episode = _extract_episode_numbers(raw_episode, season_hint)
            dedupe_key = _episode_dedupe_key(raw_episode, canonical_season, canonical_episode)
            quality_score = _episode_quality_score(raw_episode)

            episode_item = Episode(
                id=str(raw_episode.get("id", "")),
                episode_num=canonical_episode,
                title=raw_episode.get("title", "") or f"Episodio {canonical_episode}",
                container_extension=raw_episode.get("container_extension", "mp4"),
                info=raw_episode.get("info"),
            )

            bucket = season_buckets.setdefault(canonical_season, {})
            existing = bucket.get(dedupe_key)
            if existing is None or quality_score > existing[0]:
                bucket[dedupe_key] = (quality_score, episode_item)

    seasons = []
    for season_number in sorted(season_buckets.keys()):
        season_episodes = [entry[1] for entry in season_buckets[season_number].values()]
        season_episodes.sort(
            key=lambda ep: (
                ep.episode_num if ep.episode_num > 0 else 99999,
                (ep.title or "").strip().lower(),
                ep.id,
            )
        )
        seasons.append(SeasonInfo(season_number=season_number, episodes=season_episodes))

    return {
        "info": data.get('info', {}),
        "seasons": sorted(seasons, key=lambda s: s.season_number)
    }


@router.get("/search", response_model=SearchResult)
async def search_content(q: str = Query(..., min_length=1)):
    """Search movies and series by title"""
    client = get_iptv_client()
    results = await client.search(q)
    
    return SearchResult(
        movies=[
            Movie(
                stream_id=m.get('stream_id', 0),
                name=m.get('name', ''),
                stream_icon=_to_proxy_image_url(m.get('stream_icon')),
                rating=m.get('rating'),
                rating_5based=m.get('rating_5based'),
                category_id=str(m.get('category_id', '')),
                container_extension=m.get('container_extension', 'mp4'),
                year=m.get('year')
            )
            for m in results.get('movies', [])
        ],
        series=[
            Series(
                series_id=s.get('series_id', 0),
                name=s.get('name', ''),
                cover=_to_proxy_image_url(s.get('cover')),
                plot=s.get('plot'),
                cast=s.get('cast'),
                director=s.get('director'),
                genre=s.get('genre'),
                rating=s.get('rating'),
                category_id=str(s.get('category_id', ''))
            )
            for s in results.get('series', [])
        ]
    )


@router.get("/image")
async def proxy_image(url: str = Query(..., min_length=8, max_length=2048)):
    """Proxy remote posters so frontend can load them via same-origin HTTPS."""
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return _placeholder_response()
    if _is_disallowed_image_host(parsed.hostname):
        return _placeholder_response()

    # For TMDB URLs that use non-standard size formats (e.g. w600_and_h900_bestv2),
    # also try the canonical w500 size as a fallback.
    urls_to_try = [url]
    if parsed.hostname and "tmdb.org" in parsed.hostname:
        alt = re.sub(r"/t/p/[^/]+/", "/t/p/w500/", url)
        if alt != url:
            urls_to_try.append(alt)

    timeout = httpx.Timeout(timeout=20.0, connect=10.0, read=20.0, write=20.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for try_url in urls_to_try:
            try:
                upstream = await client.get(
                    try_url,
                    headers={"User-Agent": "Mozilla/5.0 IPTVSync/1.0", "Accept": "image/*,*/*;q=0.8"},
                )
            except httpx.RequestError:
                continue
            if upstream.status_code >= 400:
                continue
            content_type = (upstream.headers.get("content-type") or "image/jpeg").split(";")[0].strip().lower()
            if not content_type.startswith("image/"):
                continue
            return Response(
                content=upstream.content,
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=21600"},
            )

    return _placeholder_response()
