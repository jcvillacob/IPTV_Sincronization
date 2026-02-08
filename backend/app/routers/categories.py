from fastapi import APIRouter
from typing import List
from app.schemas import Category
from app.services import get_iptv_client

router = APIRouter()


@router.get("/movies", response_model=List[Category])
async def get_movie_categories():
    """Get all movie categories"""
    client = get_iptv_client()
    categories = await client.get_vod_categories()
    return [
        Category(
            category_id=str(c.get('category_id', '')),
            category_name=c.get('category_name', ''),
            parent_id=c.get('parent_id')
        )
        for c in categories
    ]


@router.get("/series", response_model=List[Category])
async def get_series_categories():
    """Get all series categories"""
    client = get_iptv_client()
    categories = await client.get_series_categories()
    return [
        Category(
            category_id=str(c.get('category_id', '')),
            category_name=c.get('category_name', ''),
            parent_id=c.get('parent_id')
        )
        for c in categories
    ]
