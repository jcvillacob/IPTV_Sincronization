import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category, Movie, Series, SeriesDetail, SearchResult } from '../models/content.model';

@Injectable({
    providedIn: 'root'
})
export class ContentService {
    private apiUrl = '/api';

    constructor(private http: HttpClient) { }

    // Categories
    getMovieCategories(): Observable<Category[]> {
        return this.http.get<Category[]>(`${this.apiUrl}/categories/movies`);
    }

    getSeriesCategories(): Observable<Category[]> {
        return this.http.get<Category[]>(`${this.apiUrl}/categories/series`);
    }

    // Movies
    getMovies(categoryId?: string): Observable<Movie[]> {
        const params = categoryId ? `?category_id=${categoryId}` : '';
        return this.http.get<Movie[]>(`${this.apiUrl}/content/movies${params}`);
    }

    // Series
    getSeries(categoryId?: string): Observable<Series[]> {
        const params = categoryId ? `?category_id=${categoryId}` : '';
        return this.http.get<Series[]>(`${this.apiUrl}/content/series${params}`);
    }

    getSeriesInfo(seriesId: number): Observable<SeriesDetail> {
        return this.http.get<SeriesDetail>(`${this.apiUrl}/content/series/${seriesId}/info`);
    }

    // Search
    search(query: string): Observable<SearchResult> {
        return this.http.get<SearchResult>(`${this.apiUrl}/content/search?q=${encodeURIComponent(query)}`);
    }
}
