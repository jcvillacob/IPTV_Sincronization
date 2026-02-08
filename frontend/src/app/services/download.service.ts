import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Download, DownloadCreate } from '../models/content.model';

@Injectable({
    providedIn: 'root'
})
export class DownloadService {
    private apiUrl = '/api/downloads';

    constructor(private http: HttpClient) { }

    getDownloads(): Observable<Download[]> {
        return this.http.get<Download[]>(this.apiUrl);
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

    deleteDownload(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    archiveDownload(id: number): Observable<Download> {
        return this.http.post<Download>(`${this.apiUrl}/${id}/archive`, {});
    }
}
