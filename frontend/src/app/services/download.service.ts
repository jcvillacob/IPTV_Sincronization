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

    getDownloads(status?: string): Observable<Download[]> {
        const params = status ? `?status=${status}` : '';
        return this.http.get<Download[]>(`${this.apiUrl}${params}`);
    }

    getDownload(id: number): Observable<Download> {
        return this.http.get<Download>(`${this.apiUrl}/${id}`);
    }

    createDownload(download: DownloadCreate): Observable<Download> {
        return this.http.post<Download>(this.apiUrl, download);
    }

    createBatchDownloads(downloads: DownloadCreate[]): Observable<Download[]> {
        return this.http.post<Download[]>(`${this.apiUrl}/batch`, downloads);
    }

    deleteDownload(id: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/${id}`);
    }

    retryDownload(id: number): Observable<Download> {
        return this.http.post<Download>(`${this.apiUrl}/${id}/retry`, {});
    }
}
