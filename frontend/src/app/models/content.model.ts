export interface Category {
    category_id: string;
    category_name: string;
    parent_id?: number;
}

export interface Movie {
    stream_id: number;
    name: string;
    stream_icon?: string;
    rating?: number;
    rating_5based?: number;
    category_id?: string;
    container_extension?: string;
    year?: string;
}

export interface Series {
    series_id: number;
    name: string;
    cover?: string;
    plot?: string;
    cast?: string;
    director?: string;
    genre?: string;
    rating?: string;
    category_id?: string;
}

export interface Episode {
    id: string;
    episode_num: number;
    title: string;
    container_extension?: string;
    info?: any;
}

export interface SeasonInfo {
    season_number: number;
    episodes: Episode[];
}

export interface SeriesDetail {
    info?: any;
    seasons: SeasonInfo[];
}

export interface DownloadCreate {
    stream_id: string;
    title: string;
    content_type: 'movie' | 'episode';
    series_name?: string;
    season?: number;
    episode?: number;
    poster_url?: string;
    year?: string;
    file_extension?: string;
    scheduled?: boolean;
}

export interface Download {
    id: number;
    stream_id: string;
    title: string;
    content_type: 'movie' | 'episode';
    series_name?: string;
    season?: number;
    episode?: number;
    file_path?: string;
    file_extension?: string;
    file_size: number;
    status: 'pending' | 'downloading' | 'completed' | 'error' | 'archived' | 'scheduled';
    progress: number;
    error_message?: string;
    poster_url?: string;
    year?: string;
    created_at: string;
    completed_at?: string;
    scheduled?: boolean;
    scheduled_time?: string;
}

export interface StorageInfo {
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    total_gb: number;
    used_gb: number;
    free_gb: number;
    percent_used: number;
}

export interface SearchResult {
    movies: Movie[];
    series: Series[];
}
