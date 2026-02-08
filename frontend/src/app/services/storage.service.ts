import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StorageInfo } from '../models/content.model';

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private apiUrl = '/api/storage';

    constructor(private http: HttpClient) { }

    getStorageInfo(): Observable<StorageInfo> {
        return this.http.get<StorageInfo>(`${this.apiUrl}/info`);
    }

    getArchiveStorageInfo(): Observable<StorageInfo> {
        return this.http.get<StorageInfo>(`${this.apiUrl}/archive/info`);
    }
}
