import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Download } from '../../models/content.model';
import { DownloadService } from '../../services/download.service';
import { PosterUrlPipe } from '../../pipes/poster-url.pipe';

@Component({
  selector: 'app-downloaded-series-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, PosterUrlPipe],
  template: `
    <div class="downloads-page">
      <a routerLink="/downloads/library" class="back-link">
        <lucide-icon name="chevron-down" [size]="16"></lucide-icon>
        Volver a Descargados
      </a>

      <header class="page-header" *ngIf="episodes.length > 0">
        <h1>{{ seriesName }}</h1>
        <p class="text-secondary">
          {{ episodes.length }} episodio(s) completado(s) · {{ seasons.length }} temporada(s)
        </p>
      </header>

      <div class="series-card" *ngIf="episodes.length > 0">
        <div class="download-poster">
          <img [src]="episodes[0].poster_url | safePoster" [alt]="seriesName" (error)="onImgError($event)">
        </div>
        <div>
          <h3>{{ seriesName }}</h3>
          <p class="text-secondary">Categoría: {{ episodes[0].category_name || 'Sin categoría' }}</p>
        </div>
      </div>

      <section class="season-block" *ngFor="let season of seasons">
        <h3 class="season-title">Temporada {{ season }}</h3>
        <div class="episodes-list">
          <article class="episode-item" *ngFor="let ep of getEpisodesForSeason(season)">
            <div class="ep-number">E{{ ep.episode }}</div>
            <div class="ep-info">
              <div class="ep-title">{{ ep.title }}</div>
              <div class="ep-meta">
                <span class="badge badge-success">Completado</span>
                <span class="muted" *ngIf="ep.file_size > 0">{{ formatSize(ep.file_size) }}</span>
                <span class="muted" *ngIf="ep.file_extension">{{ ep.file_extension }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <div class="empty-state" *ngIf="!loading && episodes.length === 0">
        <lucide-icon name="folder-down" [size]="56"></lucide-icon>
        <h3>Serie no encontrada</h3>
        <p class="text-muted">No hay episodios completados para esta serie.</p>
      </div>
    </div>
  `,
  styles: [`
    .downloads-page { max-width: 960px; margin: 0 auto; }
    .back-link {
      display: inline-flex; align-items: center; gap: 6px; margin-bottom: var(--spacing-md);
      color: var(--text-secondary); text-decoration: none;
    }
    .back-link:hover { color: var(--text-primary); }
    .page-header { margin-bottom: var(--spacing-lg); }
    .series-card {
      display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-md);
      border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--bg-card); margin-bottom: var(--spacing-lg);
    }
    .download-poster {
      width: 56px; height: 84px; border-radius: var(--radius-md); overflow: hidden; flex-shrink: 0; background: var(--bg-darker);
    }
    .download-poster img { width: 100%; height: 100%; object-fit: cover; }
    .season-block { margin-bottom: var(--spacing-lg); }
    .season-title { margin: 0 0 var(--spacing-sm) 0; font-size: 1rem; }
    .episodes-list {
      border: 1px solid var(--border); border-radius: var(--radius-xl); overflow: hidden; background: var(--bg-card);
    }
    .episode-item {
      display: flex; align-items: center; gap: var(--spacing-md); padding: 0.7rem 1rem; border-bottom: 1px solid var(--border);
    }
    .episode-item:last-child { border-bottom: none; }
    .ep-number { min-width: 32px; font-weight: 700; color: var(--text-muted); font-size: 0.78rem; }
    .ep-info { flex: 1; min-width: 0; }
    .ep-title { font-size: 0.9rem; font-weight: 500; margin-bottom: 3px; }
    .ep-meta { display: flex; gap: var(--spacing-sm); align-items: center; flex-wrap: wrap; }
    .badge-success { background: rgba(16,185,129,0.15); color: var(--success); }
    .muted { font-size: 0.78rem; color: var(--text-muted); }
    .empty-state { padding: 80px 20px; text-align: center; }
  `]
})
export class DownloadedSeriesDetailComponent implements OnInit {
  seriesKey = '';
  seriesName = 'Serie';
  episodes: Download[] = [];
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private downloadService: DownloadService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.seriesKey = decodeURIComponent(params.get('seriesKey') || '');
      this.loadEpisodes();
    });
    this.route.queryParamMap.subscribe(params => {
      const name = params.get('name');
      if (name) this.seriesName = name;
    });
  }

  get seasons(): number[] {
    return Array.from(new Set(this.episodes.map(e => e.season ?? 1))).sort((a, b) => a - b);
  }

  getEpisodesForSeason(season: number): Download[] {
    return this.episodes
      .filter(e => (e.season ?? 1) === season)
      .sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0));
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  private loadEpisodes() {
    this.loading = true;
    this.downloadService.getDownloads({ status: 'COMPLETED', content_type: 'EPISODE' }).subscribe({
      next: (items: Download[]) => {
        this.episodes = items
          .filter(item => this.buildSeriesKey(item) === this.seriesKey)
          .sort((a, b) => {
            if ((a.season ?? 0) !== (b.season ?? 0)) return (a.season ?? 0) - (b.season ?? 0);
            return (a.episode ?? 0) - (b.episode ?? 0);
          });
        if (this.episodes.length > 0) {
          this.seriesName = this.episodes[0].series_name || this.episodes[0].title || this.seriesName;
        }
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error loading series detail:', err);
        this.loading = false;
      }
    });
  }

  private buildSeriesKey(download: Download): string {
    if (download.series_id !== undefined && download.series_id !== null) {
      return `id:${download.series_id}`;
    }
    const base = (download.series_name || download.title || '').trim().toLowerCase();
    return `name:${base.replace(/\s+/g, ' ')}`;
  }
}
