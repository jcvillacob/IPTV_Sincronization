import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Download } from '../../models/content.model';
import { DownloadService, DownloadFilters } from '../../services/download.service';
import { PosterUrlPipe } from '../../pipes/poster-url.pipe';

interface CategoryFilterOption {
  id: string;
  name: string;
}

interface SeriesLibraryGroup {
  series_key: string;
  series_name: string;
  poster_url?: string;
  episodes: Download[];
  category_name?: string;
}

@Component({
  selector: 'app-downloaded-library',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule, PosterUrlPipe],
  template: `
    <div class="downloads-page">
      <header class="page-header">
        <h1>Descargados</h1>
        <p class="text-secondary">Biblioteca de contenido completado</p>
      </header>

      <section class="filter-section glass">
        <div class="filter-grid">
          <div class="type-filter">
            <button class="type-btn" [class.active]="contentTypeFilter === 'all'" (click)="setContentType('all')">Todos</button>
            <button class="type-btn" [class.active]="contentTypeFilter === 'movies'" (click)="setContentType('movies')">
              <lucide-icon name="film" [size]="13"></lucide-icon> Películas
            </button>
            <button class="type-btn" [class.active]="contentTypeFilter === 'series'" (click)="setContentType('series')">
              <lucide-icon name="tv" [size]="13"></lucide-icon> Series
            </button>
          </div>

          <input
            class="search-input"
            type="text"
            placeholder="Buscar por nombre..."
            [(ngModel)]="searchTerm"
            (ngModelChange)="onFiltersChange()">

          <select class="filter-select" [(ngModel)]="selectedYear" (ngModelChange)="onFiltersChange()">
            <option value="all">Todos los años</option>
            <option *ngFor="let year of yearOptions" [value]="year">{{ year }}</option>
          </select>

          <select class="filter-select" [(ngModel)]="selectedCategory" (ngModelChange)="onFiltersChange()">
            <option value="all">Todas las categorías</option>
            <option value="__NONE__">Sin categoría</option>
            <option *ngFor="let category of categoryOptions" [value]="category.id">
              {{ category.name }}
            </option>
          </select>

          <button class="btn btn-sm btn-ghost" (click)="runBackfill()" [disabled]="backfillRunning">
            <lucide-icon name="refresh-cw" [size]="14"></lucide-icon>
            {{ backfillRunning ? 'Enriqueciendo...' : 'Backfill metadata' }}
          </button>
        </div>
      </section>

      <div class="downloads-list">
        <ng-container *ngIf="contentTypeFilter !== 'series'">
          <article class="download-item" *ngFor="let download of movieDownloads; trackBy: trackByDownloadId">
            <div class="download-poster">
              <img [src]="download.poster_url | safePoster" [alt]="download.title" (error)="onImgError($event)">
            </div>
            <div class="download-info">
              <h4 class="download-title">{{ download.title }}</h4>
              <div class="download-meta">
                <span class="badge badge-success">Completado</span>
                <span *ngIf="download.year" class="muted">{{ download.year }}</span>
                <span class="muted">{{ download.category_name || 'Sin categoría' }}</span>
              </div>
            </div>
          </article>
        </ng-container>

        <ng-container *ngIf="contentTypeFilter !== 'movies'">
          <a
            class="series-card"
            *ngFor="let group of seriesGroups"
            [routerLink]="['/downloads/library/series', group.series_key]"
            [queryParams]="{ name: group.series_name }">
            <div class="download-poster">
              <img [src]="group.poster_url | safePoster" [alt]="group.series_name" (error)="onImgError($event)">
            </div>
            <div class="download-info">
              <div class="title-row">
                <span class="content-type-badge series">
                  <lucide-icon name="tv" [size]="11"></lucide-icon> Serie
                </span>
                <h4 class="download-title">{{ group.series_name }}</h4>
              </div>
              <div class="download-meta">
                <span class="badge badge-success">Completada</span>
                <span class="muted">{{ getSeasonsCount(group.episodes) }} temporada(s)</span>
                <span class="muted">{{ group.episodes.length }} episodio(s)</span>
                <span class="muted">{{ group.category_name || 'Sin categoría' }}</span>
              </div>
            </div>
            <lucide-icon name="chevron-down" [size]="18" class="chevron"></lucide-icon>
          </a>
        </ng-container>
      </div>

      <div class="empty-state" *ngIf="!loading && hasNoContent">
        <lucide-icon name="folder-down" [size]="56"></lucide-icon>
        <h3>No hay resultados</h3>
        <p class="text-muted">Ajusta los filtros o espera nuevas descargas completadas.</p>
      </div>
    </div>
  `,
  styles: [`
    .downloads-page { max-width: 1000px; margin: 0 auto; }
    .page-header { margin-bottom: var(--spacing-xl); }
    .filter-section { padding: var(--spacing-md); border-radius: var(--radius-xl); margin-bottom: var(--spacing-lg); }
    .filter-grid { display: grid; grid-template-columns: 1.3fr 1.2fr 1fr 1fr auto; gap: var(--spacing-sm); align-items: center; }
    .type-filter { display: flex; background: var(--bg-input); border-radius: var(--radius-lg); padding: 3px; gap: 3px; }
    .type-btn {
      display: flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--text-secondary);
      border-radius: var(--radius-md); padding: 0.45rem 0.7rem; cursor: pointer; font-size: 0.8rem;
    }
    .type-btn.active { background: var(--primary); color: white; }
    .search-input, .filter-select {
      width: 100%; height: 36px; border-radius: var(--radius-md); border: 1px solid var(--border);
      background: var(--bg-input); color: var(--text-primary); padding: 0 0.75rem;
    }
    .downloads-list { display: flex; flex-direction: column; gap: var(--spacing-sm); }
    .download-item, .series-card {
      display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-md) var(--spacing-lg);
      border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--bg-card);
    }
    .series-card { text-decoration: none; color: inherit; }
    .series-card:hover, .download-item:hover { border-color: var(--border-light); background: var(--bg-hover); }
    .download-poster {
      width: 56px; height: 84px; border-radius: var(--radius-md); overflow: hidden; flex-shrink: 0; background: var(--bg-darker);
    }
    .download-poster img { width: 100%; height: 100%; object-fit: cover; }
    .download-info { flex: 1; min-width: 0; }
    .title-row { display: flex; align-items: center; gap: var(--spacing-sm); margin-bottom: var(--spacing-xs); }
    .download-title { margin: 0; font-size: 1rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .download-meta { display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; }
    .muted { font-size: 0.78rem; color: var(--text-muted); }
    .badge-success { background: rgba(16,185,129,0.15); color: var(--success); }
    .content-type-badge {
      display: inline-flex; align-items: center; gap: 3px; font-size: 0.6875rem; font-weight: 700;
      padding: 2px 7px; border-radius: var(--radius-sm); text-transform: uppercase;
    }
    .content-type-badge.series { background: rgba(139,92,246,0.15); color: var(--primary); }
    .chevron { color: var(--text-muted); }
    .empty-state { padding: 80px 20px; text-align: center; }

    @media (max-width: 1024px) {
      .filter-grid { grid-template-columns: 1fr; }
      .type-filter { width: 100%; }
    }
  `]
})
export class DownloadedLibraryComponent implements OnInit {
  downloads: Download[] = [];
  contentTypeFilter: 'all' | 'movies' | 'series' = 'all';
  searchTerm = '';
  selectedYear = 'all';
  selectedCategory = 'all';
  yearOptions: string[] = [];
  categoryOptions: CategoryFilterOption[] = [];
  loading = false;
  backfillRunning = false;

  constructor(private downloadService: DownloadService) {}

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadDownloads();
  }

  get movieDownloads(): Download[] {
    return this.downloads.filter(d => d.content_type === 'MOVIE');
  }

  get seriesGroups(): SeriesLibraryGroup[] {
    const groups = new Map<string, Download[]>();
    for (const episode of this.downloads.filter(d => d.content_type === 'EPISODE')) {
      const key = this.getSeriesKey(episode);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(episode);
    }

    return Array.from(groups.entries())
      .map(([series_key, episodes]) => {
        const sorted = episodes.slice().sort((a, b) => this.compareEpisodes(a, b));
        const sample = sorted[0];
        return {
          series_key,
          series_name: sample?.series_name || sample?.title || 'Serie',
          poster_url: sample?.poster_url,
          episodes: sorted,
          category_name: sample?.category_name
        };
      })
      .sort((a, b) => a.series_name.localeCompare(b.series_name));
  }

  get hasNoContent(): boolean {
    const movieCount = this.contentTypeFilter !== 'series' ? this.movieDownloads.length : 0;
    const seriesCount = this.contentTypeFilter !== 'movies' ? this.seriesGroups.length : 0;
    return movieCount + seriesCount === 0;
  }

  setContentType(type: 'all' | 'movies' | 'series') {
    this.contentTypeFilter = type;
    this.onFiltersChange();
  }

  onFiltersChange() {
    this.loadDownloads();
  }

  runBackfill() {
    this.backfillRunning = true;
    this.downloadService.backfillMetadata().subscribe({
      next: (result: any) => {
        alert(`Backfill completado. Actualizados: ${result.updated}`);
        this.backfillRunning = false;
        this.loadFilterOptions();
        this.loadDownloads();
      },
      error: (err: any) => {
        alert(`Error: ${err.error?.detail || 'No se pudo ejecutar backfill'}`);
        this.backfillRunning = false;
      }
    });
  }

  getSeasonsCount(episodes: Download[]): number {
    return new Set(episodes.map(e => e.season ?? 1)).size;
  }

  trackByDownloadId(index: number, download: Download): number {
    return download.id;
  }

  onImgError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300">' +
      '<rect fill="#0f0f19" width="200" height="300"/>' +
      '<text x="100" y="155" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="13">Sin imagen</text>' +
      '</svg>'
    );
  }

  private loadFilterOptions() {
    this.downloadService.getDownloads({ status: 'COMPLETED' }).subscribe({
      next: (allCompleted: Download[]) => {
        this.yearOptions = Array.from(new Set(allCompleted.map(d => d.year).filter(Boolean) as string[]))
          .sort((a, b) => b.localeCompare(a));

        const categories = new Map<string, string>();
        for (const item of allCompleted) {
          if (item.category_id) {
            categories.set(item.category_id, item.category_name || item.category_id);
          }
        }
        this.categoryOptions = Array.from(categories.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));
      },
      error: (err: any) => console.error('Error loading completed filters:', err)
    });
  }

  private loadDownloads() {
    this.loading = true;
    const filters: DownloadFilters = { status: 'COMPLETED' };
    if (this.searchTerm.trim()) filters.search = this.searchTerm.trim();
    if (this.selectedYear !== 'all') filters.year = this.selectedYear;
    if (this.contentTypeFilter === 'movies') filters.content_type = 'MOVIE';
    if (this.contentTypeFilter === 'series') filters.content_type = 'EPISODE';
    if (this.selectedCategory !== 'all' && this.selectedCategory !== '__NONE__') {
      filters.category_id = this.selectedCategory;
    }

    this.downloadService.getDownloads(filters).subscribe({
      next: (items: Download[]) => {
        this.downloads = this.selectedCategory === '__NONE__'
          ? items.filter(d => !d.category_id)
          : items;
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error loading completed downloads:', err);
        this.loading = false;
      }
    });
  }

  private getSeriesKey(download: Download): string {
    if (download.series_id !== undefined && download.series_id !== null) {
      return `id:${download.series_id}`;
    }
    const base = (download.series_name || download.title || '').trim().toLowerCase();
    return `name:${base.replace(/\s+/g, ' ')}`;
  }

  private compareEpisodes(a: Download, b: Download): number {
    if ((a.season ?? 0) !== (b.season ?? 0)) return (a.season ?? 0) - (b.season ?? 0);
    return (a.episode ?? 0) - (b.episode ?? 0);
  }
}
