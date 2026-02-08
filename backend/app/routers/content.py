from fastapi import APIRouter, Query
from typing import List, Optional
from app.schemas import Movie, Series, SeasonInfo, Episode, SearchResult
from app.services import get_iptv_client

router = APIRouter()


@router.get("/movies", response_model=List[Movie])
async def get_movies(category_id: Optional[str] = Query(None)):
    """Get movies, optionally filtered by category"""
    client = get_iptv_client()
    movies = await client.get_vod_streams(category_id)
    return [
        Movie(
            stream_id=m.get('stream_id', 0),
            name=m.get('name', ''),
            stream_icon=m.get('stream_icon'),
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
            cover=s.get('cover'),
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
    
    seasons = []
    episodes_data = data.get('episodes', {})
    
    for season_num, episodes in episodes_data.items():
        season_episodes = [
            Episode(
                id=str(ep.get('id', '')),
                episode_num=ep.get('episode_num', 0),
                title=ep.get('title', ''),
                container_extension=ep.get('container_extension', 'mp4'),
                info=ep.get('info')
            )
            for ep in episodes
        ]
        seasons.append(SeasonInfo(
            season_number=int(season_num),
            episodes=season_episodes
        ))
    
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
                stream_icon=m.get('stream_icon'),
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
                cover=s.get('cover'),
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
