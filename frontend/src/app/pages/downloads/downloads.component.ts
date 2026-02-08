import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { DownloadService } from '../../services/download.service';
import { Download } from '../../models/content.model';

@Component({
  selector: 'app-downloads',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="downloads-page">
      <header class="page-header">
        <div class="header-content">
          <h1>Mis <span class="text-gradient">Descargas</span></h1>
          <p class="text-secondary">Gestiona tu cola de descargas y programaciones</p>
        </div>
      </header>
      
      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon pending">
            <lucide-icon name="clock" [size]="24"></lucide-icon>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ pendingCount }}</span>
            <span class="stat-label">Pendientes</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon downloading">
            <lucide-icon name="download" [size]="24"></lucide-icon>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ downloadingCount }}</span>
            <span class="stat-label">Descargando</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon completed">
            <lucide-icon name="check" [size]="24"></lucide-icon>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ completedCount }}</span>
            <span class="stat-label">Completadas</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon scheduled">
            <lucide-icon name="calendar" [size]="24"></lucide-icon>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ scheduledCount }}</span>
            <span class="stat-label">Programadas</span>
          </div>
        </div>
      </div>
      
      <!-- Filter Tabs -->
      <div class="filter-section glass">
        <div class="filter-tabs">
          <button 
            class="filter-tab" 
            [class.active]="filter === 'all'"
            (click)="setFilter('all')">
            Todas
          </button>
          <button 
            class="filter-tab" 
            [class.active]="filter === 'active'"
            (click)="setFilter('active')">
            Activas
          </button>
          <button 
            class="filter-tab" 
            [class.active]="filter === 'scheduled'"
            (click)="setFilter('scheduled')">
            Programadas
          </button>
          <button 
            class="filter-tab" 
            [class.active]="filter === 'completed'"
            (click)="setFilter('completed')">
            Completadas
          </button>
          <button 
            class="filter-tab" 
            [class.active]="filter === 'error'"
            (click)="setFilter('error')">
            Con Error
          </button>
        </div>
        
        <div class="bulk-actions" *ngIf="selectedDownloads.length > 0">
          <span class="selected-count">{{ selectedDownloads.length }} seleccionados</span>
          <button class="btn btn-sm btn-danger" (click)="deleteSelected()">
            <lucide-icon name="trash-2" [size]="16"></lucide-icon>
            Eliminar
          </button>
        </div>
      </div>
      
      <!-- Downloads List -->
      <div class="downloads-list">
        <div 
          class="download-item fade-in-up" 
          *ngFor="let download of filteredDownloads; let i = index"
          [class.downloading]="download.status === 'downloading'"
          [class.selected]="isSelected(download)"
          [style.animation-delay.ms]="i * 50"
          (click)="toggleSelection(download)">
          
          <div class="download-checkbox">
            <div class="checkbox" [class.checked]="isSelected(download)">
              <lucide-icon name="check" [size]="14" *ngIf="isSelected(download)"></lucide-icon>
            </div>
          </div>
          
          <div class="download-poster">
            <img [src]="download.poster_url || 'data:image/svg+xml,...'" [alt]="download.title">
            <div class="poster-badge" *ngIf="download.status === 'downloading'">
              <div class="spinner-sm"></div>
            </div>
          </div>
          
          <div class="download-info">
            <h4 class="download-title">{{ download.title }}</h4>
            <div class="download-meta">
              <span class="badge" [ngClass]="getStatusClass(download.status)">
                {{ getStatusLabel(download.status) }}
              </span>
              <span *ngIf="download.year" class="year">{{ download.year }}</span>
              <span *ngIf="download.file_extension" class="extension">{{ download.file_extension }}</span>
              <span *ngIf="download.file_size > 0" class="size">
                {{ formatSize(download.file_size) }}
              </span>
            </div>
            
            <!-- Progress Bar -->
            <div class="progress-container" *ngIf="download.status === 'downloading'">
              <div class="progress-bar">
                <div class="progress-bar-fill" [style.width.%]="download.progress"></div>
              </div>
              <span class="progress-text">{{ download.progress }}%</span>
            </div>
            
            <!-- Error Message -->
            <div class="error-message" *ngIf="download.status === 'error'">
              <lucide-icon name="alert-circle" [size]="14"></lucide-icon>
              {{ download.error_message || 'Error desconocido' }}
            </div>
          </div>
          
          <div class="download-actions" (click)="$event.stopPropagation()">
            <button 
              class="btn btn-icon btn-ghost" 
              *ngIf="download.status === 'error'"
              (click)="retryDownload(download)"
              title="Reintentar">
              <lucide-icon name="refresh-cw" [size]="18"></lucide-icon>
            </button>
            <button 
              class="btn btn-icon btn-ghost" 
              *ngIf="download.status !== 'downloading'"
              (click)="deleteDownload(download)"
              title="Eliminar">
              <lucide-icon name="trash-2" [size]="18"></lucide-icon>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div class="empty-state" *ngIf="filteredDownloads.length === 0">
        <lucide-icon name="folder-down" [size]="64" class="empty-state-icon"></lucide-icon>
        <h3>No hay descargas</h3>
        <p class="text-muted">
          {{ filter === 'all' ? 'Explora el catálogo y agrega contenido a tu cola' : 'No hay elementos con este filtro' }}
        </p>
        <a routerLink="/browse" class="btn btn-primary" *ngIf="filter === 'all'">
          <lucide-icon name="film" [size]="18"></lucide-icon>
          Explorar contenido
        </a>
      </div>
    </div>
  `,
  styles: [`
    .downloads-page {
      max-width: 1000px;
      margin: 0 auto;
    }
    
    .page-header {
      margin-bottom: var(--spacing-xl);
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-xl);
    }
    
    .stat-card {
      display: flex;
      align-items: center;
      gap: var(--spacing-lg);
      padding: var(--spacing-lg) var(--spacing-xl);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      transition: all var(--transition-normal);
    }
    
    .stat-card:hover {
      border-color: var(--border-light);
      transform: translateY(-2px);
    }
    
    .stat-icon {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-lg);
    }
    
    .stat-icon.pending {
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning);
    }
    
    .stat-icon.downloading {
      background: rgba(6, 182, 212, 0.15);
      color: var(--secondary);
    }
    
    .stat-icon.completed {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
    }
    
    .stat-icon.scheduled {
      background: rgba(139, 92, 246, 0.15);
      color: var(--primary);
    }
    
    .stat-info {
      display: flex;
      flex-direction: column;
    }
    
    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1;
    }
    
    .stat-label {
      font-size: 0.8125rem;
      color: var(--text-muted);
      margin-top: 4px;
    }
    
    .filter-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-sm);
      border-radius: var(--radius-xl);
      margin-bottom: var(--spacing-lg);
    }
    
    .filter-tabs {
      display: flex;
      gap: 4px;
    }
    
    .filter-tab {
      padding: 0.625rem 1rem;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    
    .filter-tab:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    
    .filter-tab.active {
      background: var(--primary);
      color: white;
    }
    
    .bulk-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
    }
    
    .selected-count {
      font-size: 0.875rem;
      color: var(--text-secondary);
    }
    
    .downloads-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }
    
    .download-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-md) var(--spacing-lg);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      cursor: pointer;
      transition: all var(--transition-normal);
    }
    
    .download-item:hover {
      border-color: var(--border-light);
      background: var(--bg-hover);
    }
    
    .download-item.selected {
      border-color: var(--primary);
      background: rgba(139, 92, 246, 0.05);
    }
    
    .download-item.downloading {
      border-color: var(--secondary);
      box-shadow: 0 0 20px rgba(6, 182, 212, 0.15);
    }
    
    .download-checkbox {
      flex-shrink: 0;
    }
    
    .checkbox {
      width: 22px;
      height: 22px;
      border: 2px solid var(--border);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);
    }
    
    .checkbox.checked {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }
    
    .download-poster {
      width: 56px;
      height: 84px;
      border-radius: var(--radius-md);
      overflow: hidden;
      flex-shrink: 0;
      position: relative;
      background: var(--bg-darker);
    }
    
    .download-poster img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .poster-badge {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .spinner-sm {
      width: 20px;
      height: 20px;
      border: 2px solid var(--border);
      border-top-color: var(--secondary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
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
      flex-wrap: wrap;
      margin-bottom: var(--spacing-sm);
    }
    
    .year, .extension, .size {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    
    .extension {
      text-transform: uppercase;
    }
    
    .progress-container {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      max-width: 300px;
    }
    
    .progress-container .progress-bar {
      flex: 1;
    }
    
    .progress-text {
      font-size: 0.75rem;
      color: var(--secondary);
      font-weight: 600;
      min-width: 40px;
    }
    
    .error-message {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: 0.8125rem;
      color: var(--error);
    }
    
    .download-actions {
      display: flex;
      gap: var(--spacing-xs);
    }
    
    .empty-state {
      padding: 80px 20px;
    }
    
    .empty-state h3 {
      margin-bottom: var(--spacing-sm);
    }
    
    .empty-state .btn {
      margin-top: var(--spacing-lg);
    }
  `]
})
export class DownloadsComponent implements OnInit, OnDestroy {
  downloads: Download[] = [];
  selectedDownloads: Download[] = [];
  filter: 'all' | 'active' | 'scheduled' | 'completed' | 'error' = 'all';
  private refreshInterval: any;

  constructor(private downloadService: DownloadService) { }

  ngOnInit() {
    this.loadDownloads();
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
      case 'scheduled':
        return this.downloads.filter(d => (d as any).scheduled === true);
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

  get scheduledCount(): number {
    return this.downloads.filter(d => (d as any).scheduled === true).length;
  }

  setFilter(filter: 'all' | 'active' | 'scheduled' | 'completed' | 'error') {
    this.filter = filter;
    this.selectedDownloads = [];
  }

  loadDownloads() {
    this.downloadService.getDownloads().subscribe({
      next: (downloads) => this.downloads = downloads,
      error: (err) => console.error('Error loading downloads:', err)
    });
  }

  isSelected(download: Download): boolean {
    return this.selectedDownloads.some(d => d.id === download.id);
  }

  toggleSelection(download: Download) {
    if (this.isSelected(download)) {
      this.selectedDownloads = this.selectedDownloads.filter(d => d.id !== download.id);
    } else {
      this.selectedDownloads.push(download);
    }
  }

  deleteSelected() {
    if (!confirm(`¿Eliminar ${this.selectedDownloads.length} elemento(s)?`)) return;

    this.selectedDownloads.forEach(download => {
      this.downloadService.deleteDownload(download.id).subscribe();
    });

    this.selectedDownloads = [];
    setTimeout(() => this.loadDownloads(), 500);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'completed': return 'badge-success';
      case 'downloading': return 'badge-info';
      case 'pending': return 'badge-warning';
      case 'error': return 'badge-error';
      default: return 'badge-purple';
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
    if (!confirm(`¿Eliminar "${download.title}"?`)) return;

    this.downloadService.deleteDownload(download.id).subscribe({
      next: () => this.loadDownloads(),
      error: (err) => alert(`Error: ${err.error?.detail || 'No se pudo eliminar'}`)
    });
  }
}
