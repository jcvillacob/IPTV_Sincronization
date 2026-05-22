import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Download, DownloadCreate } from '../models/content.model';

export interface DownloadFilters {
    status?: string;
    search?: string;
    year?: string;
    category_id?: string;
    content_type?: 'MOVIE' | 'EPISODE';
}

@Injectable({
    providedIn: 'root'
})
export class DownloadService {
    private apiUrl = '/api/downloads';

    constructor(private http: HttpClient) { }

    getDownloads(filters?: DownloadFilters): Observable<Download[]> {
        let params = new HttpParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    params = params.set(key, String(value));
                }
            });
        }
        return this.http.get<Download[]>(this.apiUrl, { params });
    }

    createDownload(download: DownloadCreate): Observable<Download> {
        return this.http.post<Download>(this.apiUrl, download);
    }

    createBatchDownloads(downloads: DownloadCreate[]): Observable<Download[]> {
        return this.http.post<Download[]>(`${this.apiUrl}/batch`, { downloads });
    }

    startDownload(id: number): Observable<Download> {
        return this.http.post<Download>(`${this.apiUrl}/${id}/start`, {});
    }

    retryDownload(id: number): Observable<Download> {
        return this.http.post<Download>(`${this.apiUrl}/${id}/retry`, {});
    }

    pauseDownload(id: number): Observable<Download> {
        return this.http.post<Download>(`${this.apiUrl}/${id}/pause`, {});
    }

    resumeDownload(id: number): Observable<Download> {
        return this.http.post<Download>(`${this.apiUrl}/${id}/resume`, {});
    }

    setPriority(id: number, priority: number): Observable<Download> {
        return this.http.post<Download>(`${this.apiUrl}/${id}/priority?priority=${priority}`, {});
    }

    deleteDownload(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    archiveDownload(id: number): Observable<Download> {
        return this.http.post<Download>(`${this.apiUrl}/${id}/archive`, {});
    }

    rescheduleAllPaused(): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/reschedule-all-paused`, {});
    }

    backfillMetadata(): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/backfill-metadata`, {});
    }
}
