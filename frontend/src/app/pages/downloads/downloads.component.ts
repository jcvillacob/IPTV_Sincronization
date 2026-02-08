import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DownloadService } from '../../services/download.service';
import { Download } from '../../models/content.model';

@Component({
    selector: 'app-downloads',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="downloads-page">
      <header class="page-header">
        <h1>Descargas</h1>
        <p class="text-secondary">Gestiona tus descargas y cola de espera</p>
      </header>
      
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-icon">⏳</span>
          <div class="stat-info">
            <span class="stat-value">{{ pendingCount }}</span>
            <span class="stat-label">Pendientes</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">⬇️</span>
          <div class="stat-info">
            <span class="stat-value">{{ downloadingCount }}</span>
            <span class="stat-label">Descargando</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">✅</span>
          <div class="stat-info">
            <span class="stat-value">{{ completedCount }}</span>
            <span class="stat-label">Completadas</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">❌</span>
          <div class="stat-info">
            <span class="stat-value">{{ errorCount }}</span>
            <span class="stat-label">Con Error</span>
          </div>
        </div>
      </div>
      
      <!-- Filter Tabs -->
      <div class="filter-tabs">
        <button 
          class="tab" 
          [class.active]="filter === 'all'"
          (click)="setFilter('all')">
          Todas
        </button>
        <button 
          class="tab" 
          [class.active]="filter === 'active'"
          (click)="setFilter('active')">
          Activas
        </button>
        <button 
          class="tab" 
          [class.active]="filter === 'completed'"
          (click)="setFilter('completed')">
          Completadas
        </button>
        <button 
          class="tab" 
          [class.active]="filter === 'error'"
          (click)="setFilter('error')">
          Con Error
        </button>
      </div>
      
      <!-- Downloads List -->
      <div class="downloads-list">
        <div 
          class="download-item fade-in" 
          *ngFor="let download of filteredDownloads"
          [class.downloading]="download.status === 'downloading'">
          
          <div class="download-poster">
            <img [src]="download.poster_url || 'assets/no-poster.png'" [alt]="download.title">
          </div>
          
          <div class="download-info">
            <h4 class="download-title">{{ download.title }}</h4>
            <div class="download-meta">
              <span class="badge" [ngClass]="getStatusClass(download.status)">
                {{ getStatusLabel(download.status) }}
              </span>
              <span *ngIf="download.year" class="year">{{ download.year }}</span>
              <span *ngIf="download.file_size > 0" class="size">
                {{ formatSize(download.file_size) }}
              </span>
            </div>
            
            <!-- Progress Bar -->
            <div class="progress-container" *ngIf="download.status === 'downloading' || download.status === 'pending'">
              <div class="progress-bar">
                <div class="progress-bar-fill" [style.width.%]="download.progress"></div>
              </div>
              <span class="progress-text">{{ download.progress }}%</span>
            </div>
            
            <!-- Error Message -->
            <p class="error-message" *ngIf="download.status === 'error'">
              {{ download.error_message }}
            </p>
          </div>
          
          <div class="download-actions">
            <button 
              class="btn btn-icon btn-secondary" 
              *ngIf="download.status === 'error'"
              (click)="retryDownload(download)"
              title="Reintentar">
              🔄
            </button>
            <button 
              class="btn btn-icon btn-danger" 
              *ngIf="download.status !== 'downloading'"
              (click)="deleteDownload(download)"
              title="Eliminar">
              🗑️
            </button>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div class="empty-state" *ngIf="filteredDownloads.length === 0">
        <span class="empty-icon">📥</span>
        <p>No hay descargas</p>
        <a routerLink="/browse" class="btn btn-primary">Explorar contenido</a>
      </div>
    </div>
  `,
    styles: [`
    .downloads-page {
      max-width: 1000px;
    }
    
    .page-header {
      margin-bottom: var(--spacing-xl);
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-xl);
    }
    
    .stat-card {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-lg);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
    }
    
    .stat-icon {
      font-size: 1.5rem;
    }
    
    .stat-info {
      display: flex;
      flex-direction: column;
    }
    
    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
    }
    
    .stat-label {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    
    .filter-tabs {
      display: flex;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-lg);
    }
    
    .tab {
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .tab:hover {
      background: var(--bg-hover);
    }
    
    .tab.active {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }
    
    .downloads-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }
    
    .download-item {
      display: flex;
      gap: var(--spacing-md);
      padding: var(--spacing-md);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      transition: all 0.2s ease;
    }
    
    .download-item:hover {
      border-color: var(--border-light);
    }
    
    .download-item.downloading {
      border-color: var(--primary);
      box-shadow: var(--shadow-glow);
    }
    
    .download-poster {
      width: 60px;
      height: 90px;
      border-radius: var(--radius-md);
      overflow: hidden;
      flex-shrink: 0;
    }
    
    .download-poster img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .download-info {
      flex: 1;
      min-width: 0;
    }
    
    .download-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: var(--spacing-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .download-meta {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-sm);
    }
    
    .year, .size {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    
    .progress-container {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }
    
    .progress-container .progress-bar {
      flex: 1;
    }
    
    .progress-text {
      font-size: 0.75rem;
      color: var(--text-secondary);
      min-width: 40px;
    }
    
    .error-message {
      font-size: 0.75rem;
      color: var(--error);
      margin-top: var(--spacing-xs);
    }
    
    .download-actions {
      display: flex;
      gap: var(--spacing-xs);
      align-items: flex-start;
    }
    
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-xl) * 2;
      color: var(--text-muted);
    }
    
    .empty-icon {
      font-size: 3rem;
    }
  `]
})
export class DownloadsComponent implements OnInit, OnDestroy {
    downloads: Download[] = [];
    filter: 'all' | 'active' | 'completed' | 'error' = 'all';
    private refreshInterval: any;

    constructor(private downloadService: DownloadService) { }

    ngOnInit() {
        this.loadDownloads();
        // Auto-refresh every 3 seconds
        this.refreshInterval = setInterval(() => this.loadDownloads(), 3000);
    }

    ngOnDestroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    get filteredDownloads(): Download[] {
        switch (this.filter) {
            case 'active':
                return this.downloads.filter(d =>
                    d.status === 'pending' || d.status === 'downloading'
                );
            case 'completed':
                return this.downloads.filter(d => d.status === 'completed');
            case 'error':
                return this.downloads.filter(d => d.status === 'error');
            default:
                return this.downloads;
        }
    }

    get pendingCount(): number {
        return this.downloads.filter(d => d.status === 'pending').length;
    }

    get downloadingCount(): number {
        return this.downloads.filter(d => d.status === 'downloading').length;
    }

    get completedCount(): number {
        return this.downloads.filter(d => d.status === 'completed').length;
    }

    get errorCount(): number {
        return this.downloads.filter(d => d.status === 'error').length;
    }

    setFilter(filter: 'all' | 'active' | 'completed' | 'error') {
        this.filter = filter;
    }

    loadDownloads() {
        this.downloadService.getDownloads().subscribe({
            next: (downloads) => this.downloads = downloads,
            error: (err) => console.error('Error loading downloads:', err)
        });
    }

    getStatusClass(status: string): string {
        switch (status) {
            case 'completed': return 'badge-success';
            case 'downloading': return 'badge-info';
            case 'pending': return 'badge-warning';
            case 'error': return 'badge-error';
            default: return '';
        }
    }

    getStatusLabel(status: string): string {
        switch (status) {
            case 'completed': return 'Completado';
            case 'downloading': return 'Descargando';
            case 'pending': return 'Pendiente';
            case 'error': return 'Error';
            case 'archived': return 'Archivado';
            default: return status;
        }
    }

    formatSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    retryDownload(download: Download) {
        this.downloadService.retryDownload(download.id).subscribe({
            next: () => this.loadDownloads(),
            error: (err) => alert(`Error: ${err.error?.detail || 'No se pudo reintentar'}`)
        });
    }

    deleteDownload(download: Download) {
        if (confirm(`¿Eliminar "${download.title}" de la lista?`)) {
            this.downloadService.deleteDownload(download.id).subscribe({
                next: () => this.loadDownloads(),
                error: (err) => alert(`Error: ${err.error?.detail || 'No se pudo eliminar'}`)
            });
        }
    }
}
