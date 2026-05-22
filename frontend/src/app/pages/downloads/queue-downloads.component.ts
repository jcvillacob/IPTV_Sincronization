import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { DownloadService } from '../../services/download.service';
import { Download } from '../../models/content.model';
import { PosterUrlPipe } from '../../pipes/poster-url.pipe';

interface SeriesGroup {
  series_key: string;
  series_name: string;
  poster_url?: string;
  episodes: Download[]; // Episodes matching active tab filter
  allEpisodes: Download[]; // Full context for this series across statuses
  expanded: boolean;
  showAllEpisodes: boolean;
}

@Component({
  selector: 'app-queue-downloads',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, PosterUrlPipe],
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

      <!-- Disk Full Alert -->
      <div class="disk-full-alert glass" *ngIf="diskFullPausedCount > 0">
        <div class="alert-content">
          <lucide-icon name="hard-drive" [size]="24"></lucide-icon>
          <div class="alert-text">
            <strong>Disco lleno</strong>
            <p>{{ diskFullPausedCount }} descarga(s) pausada(s) por falta de espacio.</p>
          </div>
        </div>
        <div class="alert-actions">
          <button class="btn btn-primary btn-sm" (click)="rescheduleAll()">
            <lucide-icon name="calendar" [size]="16"></lucide-icon>
            Reprogramar todo a la 1 AM
          </button>
        </div>
      </div>

      <!-- Filter Section -->
      <div class="filter-section glass">
        <div class="filter-row">
          <div class="filter-tabs">
            <button class="filter-tab" [class.active]="filter === 'all'" (click)="setFilter('all')">Todas</button>
            <button class="filter-tab" [class.active]="filter === 'active'" (click)="setFilter('active')">Activas</button>
            <button class="filter-tab" [class.active]="filter === 'scheduled'" (click)="setFilter('scheduled')">Programadas</button>
            <button class="filter-tab" [class.active]="filter === 'error'" (click)="setFilter('error')">Con Error</button>
          </div>
          <div class="type-filter">
            <button class="type-btn" [class.active]="contentTypeFilter === 'all'" (click)="contentTypeFilter = 'all'">
              Todos
            </button>
            <button class="type-btn" [class.active]="contentTypeFilter === 'movies'" (click)="contentTypeFilter = 'movies'">
              <lucide-icon name="film" [size]="13"></lucide-icon> Películas
            </button>
            <button class="type-btn" [class.active]="contentTypeFilter === 'series'" (click)="contentTypeFilter = 'series'">
              <lucide-icon name="tv" [size]="13"></lucide-icon> Series
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
      </div>

      <!-- Downloads List -->
      <div class="downloads-list">

        <!-- ── PELÍCULAS ── -->
        <ng-container *ngIf="contentTypeFilter !== 'series'">
          <div
            class="download-item"
            *ngFor="let download of movieDownloads; trackBy: trackByDownloadId"
            [class.downloading]="download.status === 'DOWNLOADING'"
            [class.selected]="isSelected(download)"
            (click)="toggleSelection(download)">

            <div class="download-checkbox">
              <div class="checkbox" [class.checked]="isSelected(download)">
                <lucide-icon name="check" [size]="14" *ngIf="isSelected(download)"></lucide-icon>
              </div>
            </div>

            <div class="download-poster">
              <img [src]="download.poster_url | safePoster" [alt]="download.title" (error)="onImgError($event)">
              <div class="poster-badge" *ngIf="download.status === 'DOWNLOADING'">
                <div class="spinner-sm"></div>
              </div>
            </div>

            <div class="download-info">
              <div class="title-row">
                <span class="content-type-badge movie">
                  <lucide-icon name="film" [size]="11"></lucide-icon> Película
                </span>
                <h4 class="download-title">{{ download.title }}</h4>
              </div>
              <div class="download-meta">
                <span class="badge" [ngClass]="download.disk_full_paused ? 'badge-error' : getStatusClass(download.status)">
                  {{ download.disk_full_paused ? 'Disco lleno' : getStatusLabel(download.status) }}
                </span>
                <span *ngIf="download.year" class="year">{{ download.year }}</span>
                <span *ngIf="download.file_extension" class="extension">{{ download.file_extension }}</span>
                <span *ngIf="download.file_size > 0" class="size">{{ formatSize(download.file_size) }}</span>
              </div>

              <div class="progress-container" *ngIf="download.status === 'DOWNLOADING'">
                <div class="progress-bar">
                  <div class="progress-bar-fill" [style.width.%]="download.progress"></div>
                </div>
                <span class="progress-text">{{ download.progress }}%</span>
              </div>

              <div class="error-message" *ngIf="download.status === 'ERROR' || isRetryExhaustedPause(download)">
                <lucide-icon name="alert-circle" [size]="14"></lucide-icon>
                {{ download.error_message || 'Error desconocido' }}
              </div>
              <div class="retry-message" *ngIf="showRetryInfo(download)">
                <lucide-icon name="refresh-cw" [size]="14"></lucide-icon>
                {{ getRetryCountdownText(download) }}
              </div>
            </div>

            <div class="download-actions" (click)="$event.stopPropagation()">
              <button class="btn btn-icon btn-ghost" *ngIf="download.status === 'DOWNLOADING'" (click)="pauseDownload(download)" title="Pausar">
                <lucide-icon name="x" [size]="18"></lucide-icon>
              </button>
              <button class="btn btn-icon btn-ghost" *ngIf="download.status === 'PAUSED'" (click)="resumeDownload(download)" title="Reanudar">
                <lucide-icon name="play" [size]="18"></lucide-icon>
              </button>
              <button class="btn btn-icon btn-ghost" *ngIf="download.status === 'SCHEDULED'" (click)="startDownloadNow(download)" title="Iniciar ahora">
                <lucide-icon name="play" [size]="18"></lucide-icon>
              </button>
              <button class="btn btn-icon btn-ghost" *ngIf="['PENDING', 'PAUSED'].includes(download.status)" (click)="setTopPriority(download)" title="Priorizar">
                <lucide-icon name="plus" [size]="18"></lucide-icon>
              </button>
              <button class="btn btn-icon btn-ghost" *ngIf="download.status === 'ERROR'" (click)="retryDownload(download)" title="Reintentar">
                <lucide-icon name="refresh-cw" [size]="18"></lucide-icon>
              </button>
              <button class="btn btn-icon btn-ghost" (click)="deleteDownload(download)" title="Eliminar">
                <lucide-icon name="trash-2" [size]="18"></lucide-icon>
              </button>
            </div>
          </div>
        </ng-container>

        <!-- ── SERIES (agrupadas) ── -->
        <ng-container *ngIf="contentTypeFilter !== 'movies'">
          <div
            class="series-group"
            *ngFor="let group of seriesGroups; trackBy: trackBySeriesKey"
            [class.group-downloading]="hasDownloadingEpisodes(group.allEpisodes)"
            >

            <!-- Cabecera de la serie -->
            <div class="series-group-header" (click)="toggleSeriesExpand(group.series_key)">
              <div class="download-poster">
                <img [src]="group.poster_url | safePoster" [alt]="group.series_name" (error)="onImgError($event)">
                <div class="poster-badge" *ngIf="hasDownloadingEpisodes(group.allEpisodes)">
                  <div class="spinner-sm"></div>
                </div>
              </div>

              <div class="download-info">
                <div class="title-row">
                  <span class="content-type-badge series">
                    <lucide-icon name="tv" [size]="11"></lucide-icon> Serie
                  </span>
                  <h4 class="download-title">{{ group.series_name }}</h4>
                </div>
                <div class="download-meta">
                  <span class="badge" [ngClass]="getSeriesStatusClass(group.allEpisodes)">
                    {{ getSeriesStatusLabel(group.allEpisodes) }}
                  </span>
                  <span class="ep-stat">{{ getActiveCount(group.allEpisodes) }} activos</span>
                  <span class="ep-stat">{{ getCompletedCount(group.allEpisodes) }}/{{ group.allEpisodes.length }} completados</span>
                  <span class="ep-stat">Mostrando {{ getVisibleEpisodes(group).length }} ep.</span>
                  <span class="ep-stat error" *ngIf="getErrorCount(group.allEpisodes) > 0">
                    <lucide-icon name="alert-circle" [size]="12"></lucide-icon>
                    {{ getErrorCount(group.allEpisodes) }} error(es)
                  </span>
                </div>

                <div class="progress-container" *ngIf="hasDownloadingEpisodes(group.allEpisodes)">
                  <div class="progress-bar">
                    <div class="progress-bar-fill" [style.width.%]="getOverallProgress(group.allEpisodes)"></div>
                  </div>
                  <span class="progress-text">{{ getOverallProgress(group.allEpisodes) }}%</span>
                </div>
              </div>

              <div class="series-header-actions" (click)="$event.stopPropagation()">
                <button
                  class="btn btn-sm btn-ghost"
                  *ngIf="group.episodes.length !== group.allEpisodes.length"
                  (click)="toggleSeriesEpisodeScope(group.series_key)">
                  {{ group.showAllEpisodes ? 'Ver solo filtrados' : 'Ver todos los episodios' }}
                </button>
                <button class="btn btn-icon btn-ghost" (click)="deleteSeriesGroup(group)" title="Eliminar toda la serie">
                  <lucide-icon name="trash-2" [size]="18"></lucide-icon>
                </button>
              </div>

              <div class="expand-btn">
                <lucide-icon name="chevron-down" [size]="20" [class.rotated]="group.expanded"></lucide-icon>
              </div>
            </div>

            <!-- Panel de episodios (expandido) -->
            <div class="series-episodes" *ngIf="group.expanded">
              <ng-container *ngFor="let season of getSeasons(getVisibleEpisodes(group))">
                <div class="season-header">
                  <lucide-icon name="grid" [size]="13"></lucide-icon>
                  Temporada {{ season }}
                  <span class="season-count">· {{ getEpisodesForSeason(getVisibleEpisodes(group), season).length }} episodios</span>
                </div>

                <div
                  class="episode-item"
                  *ngFor="let ep of getEpisodesForSeason(getVisibleEpisodes(group), season); trackBy: trackByDownloadId"
                  [class.ep-downloading]="ep.status === 'DOWNLOADING'"
                  [class.ep-completed]="ep.status === 'COMPLETED'"
                  [class.ep-error]="ep.status === 'ERROR'">

                  <div class="ep-status-dot" [ngClass]="'dot-' + ep.status.toLowerCase()"></div>

                  <div class="ep-number">E{{ ep.episode }}</div>

                  <div class="ep-info">
                    <span class="ep-title">{{ ep.title }}</span>
                    <div class="ep-meta">
                      <span class="badge badge-sm" [ngClass]="ep.disk_full_paused ? 'badge-error' : getStatusClass(ep.status)">
                        {{ ep.disk_full_paused ? 'Disco lleno' : getStatusLabel(ep.status) }}
                      </span>
                      <span *ngIf="ep.file_size > 0" class="size">{{ formatSize(ep.file_size) }}</span>
                      <span *ngIf="ep.file_extension" class="extension">{{ ep.file_extension }}</span>
                    </div>
                    <div class="progress-container progress-sm" *ngIf="ep.status === 'DOWNLOADING'">
                      <div class="progress-bar">
                        <div class="progress-bar-fill" [style.width.%]="ep.progress"></div>
                      </div>
                      <span class="progress-text">{{ ep.progress }}%</span>
                    </div>
                    <div class="error-message error-sm" *ngIf="ep.status === 'ERROR' || isRetryExhaustedPause(ep)">
                      <lucide-icon name="alert-circle" [size]="12"></lucide-icon>
                      {{ ep.error_message || 'Error desconocido' }}
                    </div>
                    <div class="retry-message retry-sm" *ngIf="showRetryInfo(ep)">
                      <lucide-icon name="refresh-cw" [size]="12"></lucide-icon>
                      {{ getRetryCountdownText(ep) }}
                    </div>
                  </div>

                  <div class="ep-actions" (click)="$event.stopPropagation()">
                    <button class="btn btn-icon btn-ghost btn-xs" *ngIf="ep.status === 'DOWNLOADING'" (click)="pauseDownload(ep)" title="Pausar">
                      <lucide-icon name="x" [size]="16"></lucide-icon>
                    </button>
                    <button class="btn btn-icon btn-ghost btn-xs" *ngIf="ep.status === 'PAUSED'" (click)="resumeDownload(ep)" title="Reanudar">
                      <lucide-icon name="play" [size]="16"></lucide-icon>
                    </button>
                    <button class="btn btn-icon btn-ghost btn-xs" *ngIf="ep.status === 'SCHEDULED'" (click)="startDownloadNow(ep)" title="Iniciar ahora">
                      <lucide-icon name="play" [size]="16"></lucide-icon>
                    </button>
                    <button class="btn btn-icon btn-ghost btn-xs" *ngIf="ep.status === 'ERROR'" (click)="retryDownload(ep)" title="Reintentar">
                      <lucide-icon name="refresh-cw" [size]="16"></lucide-icon>
                    </button>
                    <button class="btn btn-icon btn-ghost btn-xs" (click)="deleteDownload(ep)" title="Eliminar">
                      <lucide-icon name="trash-2" [size]="16"></lucide-icon>
                    </button>
                  </div>
                </div>
              </ng-container>
            </div>
          </div>
        </ng-container>

      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="hasNoContent">
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

    .stat-icon.pending  { background: rgba(245,158,11,0.15); color: var(--warning); }
    .stat-icon.downloading { background: rgba(6,182,212,0.15); color: var(--secondary); }
    .stat-icon.completed { background: rgba(16,185,129,0.15); color: var(--success); }
    .stat-icon.scheduled { background: rgba(139,92,246,0.15); color: var(--primary); }

    .stat-info { display: flex; flex-direction: column; }
    .stat-value { font-size: 1.75rem; font-weight: 700; line-height: 1; }
    .stat-label { font-size: 0.8125rem; color: var(--text-muted); margin-top: 4px; }

    /* ── Filter Section ── */
    .filter-section {
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-xl);
      margin-bottom: var(--spacing-lg);
    }

    .filter-row {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      flex-wrap: wrap;
    }

    .filter-tabs {
      display: flex;
      gap: 4px;
      flex: 1;
      flex-wrap: wrap;
    }

    .filter-tab {
      padding: 0.5rem 0.875rem;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .filter-tab:hover { background: var(--bg-hover); color: var(--text-primary); }
    .filter-tab.active { background: var(--primary); color: white; }

    .type-filter {
      display: flex;
      background: var(--bg-input);
      border-radius: var(--radius-lg);
      padding: 3px;
      gap: 2px;
      flex-shrink: 0;
    }

    .type-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 0.375rem 0.75rem;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .type-btn.active { background: var(--primary); color: white; }

    .bulk-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      flex-shrink: 0;
    }

    .selected-count { font-size: 0.875rem; color: var(--text-secondary); }

    /* ── Downloads List ── */
    .downloads-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    /* ── Movie Item ── */
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

    .download-item:hover { border-color: var(--border-light); background: var(--bg-hover); }
    .download-item.selected { border-color: var(--primary); background: rgba(139,92,246,0.05); }
    .download-item.downloading { border-color: var(--secondary); box-shadow: 0 0 20px rgba(6,182,212,0.15); }

    .download-checkbox { flex-shrink: 0; }

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

    .checkbox.checked { background: var(--primary); border-color: var(--primary); color: white; }

    /* ── Poster ── */
    .download-poster {
      width: 56px;
      height: 84px;
      border-radius: var(--radius-md);
      overflow: hidden;
      flex-shrink: 0;
      position: relative;
      background: var(--bg-darker);
    }

    .download-poster img { width: 100%; height: 100%; object-fit: cover; }

    .poster-badge {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.6);
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

    /* ── Info ── */
    .download-info { flex: 1; min-width: 0; }

    .title-row {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-xs);
    }

    .content-type-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: var(--radius-sm);
      flex-shrink: 0;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .content-type-badge.movie { background: rgba(6,182,212,0.15); color: var(--secondary); }
    .content-type-badge.series { background: rgba(139,92,246,0.15); color: var(--primary); }

    .download-title {
      font-size: 1rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 0;
    }

    .download-meta {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      flex-wrap: wrap;
      margin-bottom: var(--spacing-sm);
    }

    .year, .extension, .size { font-size: 0.75rem; color: var(--text-muted); }
    .extension { text-transform: uppercase; }

    .progress-container {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      max-width: 320px;
    }

    .progress-container .progress-bar { flex: 1; }

    .progress-text {
      font-size: 0.75rem;
      color: var(--secondary);
      font-weight: 600;
      min-width: 38px;
      text-align: right;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: 0.8125rem;
      color: var(--error);
    }

    .retry-message {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: 0.8125rem;
      color: var(--warning);
      margin-top: 2px;
    }

    .download-actions { display: flex; gap: var(--spacing-xs); flex-shrink: 0; }

    /* ── Series Group ── */
    .series-group {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      overflow: hidden;
      transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
    }

    .series-group.group-downloading {
      border-color: var(--secondary);
      box-shadow: 0 0 20px rgba(6,182,212,0.15);
    }

    .series-group-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-md) var(--spacing-lg);
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .series-group-header:hover { background: var(--bg-hover); }

    .series-header-actions { flex-shrink: 0; }

    .expand-btn {
      flex-shrink: 0;
      color: var(--text-muted);
      padding: 4px;
    }

    .expand-btn .rotated {
      transform: rotate(180deg);
    }

    .ep-stat {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .ep-stat.error {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: var(--error);
    }

    /* ── Episodes Panel ── */
    .series-episodes {
      border-top: 1px solid var(--border);
      background: var(--bg-darker);
    }

    .season-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: 0.5rem 1.5rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: rgba(255,255,255,0.025);
      border-bottom: 1px solid var(--border);
    }

    .season-count {
      font-weight: 400;
      text-transform: none;
      letter-spacing: 0;
      color: var(--text-muted);
    }

    .episode-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: 0.625rem 1.5rem;
      border-bottom: 1px solid var(--border);
      transition: background var(--transition-fast);
    }

    .episode-item:last-child { border-bottom: none; }
    .episode-item:hover { background: var(--bg-hover); }
    .episode-item.ep-downloading { background: rgba(6,182,212,0.04); }
    .episode-item.ep-completed { opacity: 0.65; }
    .episode-item.ep-error { background: rgba(239,68,68,0.05); }

    /* Status dot */
    .ep-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .dot-downloading { background: var(--secondary); box-shadow: 0 0 6px var(--secondary); animation: pulse 1.5s ease-in-out infinite; }
    .dot-completed { background: var(--success); }
    .dot-error { background: var(--error); }
    .dot-pending { background: var(--warning); }
    .dot-paused { background: var(--text-muted); }
    .dot-scheduled { background: var(--primary); }
    .dot-archived { background: var(--text-muted); }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .ep-number {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-muted);
      min-width: 28px;
      flex-shrink: 0;
    }

    .ep-info { flex: 1; min-width: 0; }

    .ep-title {
      font-size: 0.875rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      margin-bottom: 3px;
    }

    .ep-meta {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      margin-bottom: 4px;
    }

    .badge-sm { font-size: 0.625rem !important; padding: 2px 6px !important; }

    .progress-sm { max-width: 240px; }

    .error-sm {
      font-size: 0.75rem;
    }

    .retry-sm {
      font-size: 0.75rem;
    }

    .ep-actions { display: flex; gap: 2px; flex-shrink: 0; }

    .btn-xs { padding: 4px !important; }

    /* ── Alerts ── */
    .disk-full-alert {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-lg) var(--spacing-xl);
      border-radius: var(--radius-xl);
      margin-bottom: var(--spacing-lg);
      border: 1px solid var(--error);
      background: rgba(239,68,68,0.1);
    }

    .alert-content {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      color: var(--error);
    }

    .alert-text p { margin: 0; font-size: 0.875rem; color: var(--text-secondary); }
    .alert-actions .btn { display: flex; align-items: center; gap: var(--spacing-xs); }

    /* ── Empty State ── */
    .empty-state { padding: 80px 20px; }
    .empty-state h3 { margin-bottom: var(--spacing-sm); }
    .empty-state .btn { margin-top: var(--spacing-lg); }
  `]
})
export class QueueDownloadsComponent implements OnInit, OnDestroy {
  downloads: Download[] = [];
  selectedDownloads: Download[] = [];
  filter: 'all' | 'active' | 'scheduled' | 'error' = 'all';
  contentTypeFilter: 'all' | 'movies' | 'series' = 'all';
  expandedSeries: Set<string> = new Set();
  showAllSeriesEpisodes: Set<string> = new Set();
  diskFullPausedCount: number = 0;
  private refreshInterval: any;

  constructor(private downloadService: DownloadService) { }

  ngOnInit() {
    this.loadDownloads();
    this.refreshInterval = setInterval(() => this.loadDownloads(), 3000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  // ── Filtered base ──────────────────────────────────────────────────────────

  get filteredDownloads(): Download[] {
    switch (this.filter) {
      case 'active':
        return this.downloads.filter(d => d.status === 'PENDING' || d.status === 'DOWNLOADING');
      case 'scheduled':
        return this.downloads.filter(d => d.scheduled === true);
      case 'error':
        return this.downloads.filter(d => d.status === 'ERROR' || this.isRetryExhaustedPause(d));
      default:
        return this.downloads.filter(d => d.status !== 'COMPLETED' && d.status !== 'ARCHIVED');
    }
  }

  get movieDownloads(): Download[] {
    return this.filteredDownloads.filter(d => d.content_type === 'MOVIE');
  }

  get seriesGroups(): SeriesGroup[] {
    const allEpisodeDownloads = this.downloads.filter(d => d.content_type === 'EPISODE');
    const filteredEpisodes = this.filteredDownloads.filter(d => d.content_type === 'EPISODE');
    const allGroups = new Map<string, Download[]>();
    const filteredGroupKeys = new Set<string>();

    for (const ep of allEpisodeDownloads) {
      const key = this.getSeriesKey(ep);
      if (!allGroups.has(key)) allGroups.set(key, []);
      allGroups.get(key)!.push(ep);
    }

    for (const ep of filteredEpisodes) {
      filteredGroupKeys.add(this.getSeriesKey(ep));
    }

    return Array.from(filteredGroupKeys.values())
      .map((key: string) => {
        const allEpisodes = (allGroups.get(key) || []).slice().sort((a, b) => this.compareEpisodes(a, b));
        const episodes = filteredEpisodes
          .filter(ep => this.getSeriesKey(ep) === key)
          .slice()
          .sort((a, b) => this.compareEpisodes(a, b));
        const sample = allEpisodes[0] || episodes[0];
        return {
          series_key: key,
          series_name: sample?.series_name || sample?.title || 'Serie',
          poster_url: sample?.poster_url,
          episodes,
          allEpisodes,
          expanded: this.expandedSeries.has(key),
          showAllEpisodes: this.showAllSeriesEpisodes.has(key)
        };
      })
      .sort((a, b) => a.series_name.localeCompare(b.series_name));
  }

  get hasNoContent(): boolean {
    const m = this.contentTypeFilter !== 'series' ? this.movieDownloads.length : 0;
    const s = this.contentTypeFilter !== 'movies' ? this.seriesGroups.length : 0;
    return m + s === 0;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  get pendingCount(): number    { return this.downloads.filter(d => d.status === 'PENDING').length; }
  get downloadingCount(): number { return this.downloads.filter(d => d.status === 'DOWNLOADING').length; }
  get completedCount(): number  { return this.downloads.filter(d => d.status === 'COMPLETED').length; }
  get scheduledCount(): number  { return this.downloads.filter(d => d.scheduled === true).length; }

  // ── Filter ────────────────────────────────────────────────────────────────

  setFilter(filter: 'all' | 'active' | 'scheduled' | 'error') {
    this.filter = filter;
    this.selectedDownloads = [];
  }

  // ── Series helpers ────────────────────────────────────────────────────────

  toggleSeriesExpand(seriesKey: string) {
    const next = new Set(this.expandedSeries);
    if (next.has(seriesKey)) {
      next.delete(seriesKey);
    } else {
      next.add(seriesKey);
    }
    this.expandedSeries = next;
  }

  toggleSeriesEpisodeScope(seriesKey: string) {
    const next = new Set(this.showAllSeriesEpisodes);
    if (next.has(seriesKey)) {
      next.delete(seriesKey);
    } else {
      next.add(seriesKey);
    }
    this.showAllSeriesEpisodes = next;
  }

  getVisibleEpisodes(group: SeriesGroup): Download[] {
    return group.showAllEpisodes ? group.allEpisodes : group.episodes;
  }

  getSeasons(episodes: Download[]): number[] {
    return [...new Set(episodes.map(e => e.season ?? 1))].sort((a, b) => a - b);
  }

  getEpisodesForSeason(episodes: Download[], season: number): Download[] {
    return episodes
      .filter(e => (e.season ?? 1) === season)
      .sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0));
  }

  getOverallProgress(episodes: Download[]): number {
    if (!episodes.length) return 0;
    return Math.round(episodes.reduce((s, e) => s + (e.progress || 0), 0) / episodes.length);
  }

  getCompletedCount(episodes: Download[]): number {
    return episodes.filter(e => e.status === 'COMPLETED').length;
  }

  getActiveCount(episodes: Download[]): number {
    return episodes.filter(e => e.status === 'PENDING' || e.status === 'DOWNLOADING').length;
  }

  getErrorCount(episodes: Download[]): number {
    return episodes.filter(e => e.status === 'ERROR').length;
  }

  hasDownloadingEpisodes(episodes: Download[]): boolean {
    return episodes.some(e => e.status === 'DOWNLOADING');
  }

  getSeriesStatusClass(episodes: Download[]): string {
    if (episodes.some(e => e.status === 'DOWNLOADING')) return 'badge-info';
    if (episodes.every(e => e.status === 'COMPLETED')) return 'badge-success';
    if (episodes.some(e => e.status === 'ERROR')) return 'badge-error';
    if (episodes.some(e => e.status === 'SCHEDULED')) return 'badge-purple';
    return 'badge-warning';
  }

  getSeriesStatusLabel(episodes: Download[]): string {
    const completed = this.getCompletedCount(episodes);
    const downloading = episodes.filter(e => e.status === 'DOWNLOADING').length;
    if (downloading > 0) return `Descargando`;
    if (completed === episodes.length) return 'Completa';
    if (episodes.some(e => e.status === 'ERROR')) return 'Con errores';
    if (episodes.some(e => e.status === 'SCHEDULED')) return 'Programada';
    return `${completed}/${episodes.length} ep.`;
  }

  deleteSeriesGroup(group: SeriesGroup) {
    if (!confirm(`¿Eliminar todos los episodios de "${group.series_name}" (${group.allEpisodes.length} ep.)?`)) return;
    Promise.all(group.allEpisodes.map(ep => this.downloadService.deleteDownload(ep.id).toPromise()))
      .then(() => this.loadDownloads());
  }

  private getSeriesKey(download: Download): string {
    if (download.series_id !== undefined && download.series_id !== null) {
      return `id:${download.series_id}`;
    }
    const name = (download.series_name || download.title || '').trim().toLowerCase();
    return `name:${name.replace(/\s+/g, ' ')}`;
  }

  private compareEpisodes(a: Download, b: Download): number {
    if ((a.season ?? 0) !== (b.season ?? 0)) return (a.season ?? 0) - (b.season ?? 0);
    return (a.episode ?? 0) - (b.episode ?? 0);
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

  // ── Data loading ──────────────────────────────────────────────────────────

  loadDownloads() {
    this.downloadService.getDownloads().subscribe({
      next: (newDownloads: Download[]) => {
        if (this.downloads.length === 0 || this.downloads.length !== newDownloads.length) {
          this.downloads = newDownloads;
        } else {
          newDownloads.forEach((newDl: Download) => {
            const existing = this.downloads.find(d => d.id === newDl.id);
            if (existing) {
              existing.status = newDl.status;
              existing.progress = newDl.progress;
              existing.file_size = newDl.file_size;
              existing.error_message = newDl.error_message;
              existing.file_path = newDl.file_path;
              existing.disk_full_paused = newDl.disk_full_paused;
              existing.scheduled = newDl.scheduled;
              existing.scheduled_time = newDl.scheduled_time;
              existing.retry_count = newDl.retry_count;
              existing.next_retry_at = newDl.next_retry_at;
              existing.last_attempt_at = newDl.last_attempt_at;
              existing.last_progress_at = newDl.last_progress_at;
              existing.last_error_at = newDl.last_error_at;
            }
          });
        }
        this.diskFullPausedCount = newDownloads.filter(d => d.disk_full_paused).length;
      },
      error: (err: any) => console.error('Error loading downloads:', err)
    });
  }

  trackByDownloadId(index: number, download: Download): number {
    return download.id;
  }

  trackBySeriesKey(index: number, group: SeriesGroup): string {
    return group.series_key;
  }

  // ── Selection ─────────────────────────────────────────────────────────────

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
    this.selectedDownloads.forEach(download => this.downloadService.deleteDownload(download.id).subscribe());
    this.selectedDownloads = [];
    setTimeout(() => this.loadDownloads(), 500);
  }

  // ── Status helpers ────────────────────────────────────────────────────────

  getStatusClass(status: string): string {
    switch (status) {
      case 'COMPLETED':  return 'badge-success';
      case 'DOWNLOADING': return 'badge-info';
      case 'PENDING':    return 'badge-warning';
      case 'PAUSED':     return 'badge-warning';
      case 'ERROR':      return 'badge-error';
      default:           return 'badge-purple';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'COMPLETED':  return 'Completado';
      case 'DOWNLOADING': return 'Descargando';
      case 'PENDING':    return 'Pendiente';
      case 'PAUSED':     return 'Pausado';
      case 'ERROR':      return 'Error';
      case 'ARCHIVED':   return 'Archivado';
      case 'SCHEDULED':  return 'Programado';
      default:           return status;
    }
  }

  isRetryExhaustedPause(download: Download): boolean {
    return download.status === 'PAUSED' && (download.error_message || '').toLowerCase().includes('reintentos agotados');
  }

  showRetryInfo(download: Download): boolean {
    return !!download.next_retry_at && download.status === 'PENDING';
  }

  getRetryCountdownText(download: Download): string {
    if (!download.next_retry_at) return '';
    const retryAt = new Date(download.next_retry_at).getTime();
    const diffSeconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
    if (diffSeconds === 0) return 'Reintentando...';
    return `Reintento automatico en ${diffSeconds}s`;
  }

  // ── Download actions ──────────────────────────────────────────────────────

  rescheduleAll() {
    if (!confirm('¿Reprogramar todas las descargas pausadas por disco lleno para mañana a la 1 AM?')) return;
    this.downloadService.rescheduleAllPaused().subscribe({
      next: (result: any) => { alert(result.message); this.loadDownloads(); },
      error: (err: any) => alert(`Error: ${err.error?.detail || 'No se pudo reprogramar'}`)
    });
  }

  retryDownload(download: Download) {
    this.downloadService.retryDownload(download.id).subscribe({
      next: () => this.loadDownloads(),
      error: (err: any) => alert(`Error: ${err.error?.detail || 'No se pudo reintentar'}`)
    });
  }

  deleteDownload(download: Download) {
    if (!confirm(`¿Eliminar "${download.title}"?`)) return;
    this.downloadService.deleteDownload(download.id).subscribe({
      next: () => this.loadDownloads(),
      error: (err: any) => alert(`Error: ${err.error?.detail || 'No se pudo eliminar'}`)
    });
  }

  pauseDownload(download: Download) {
    this.downloadService.pauseDownload(download.id).subscribe({
      next: () => this.loadDownloads(),
      error: (err: any) => alert(`Error: ${err.error?.detail || 'No se pudo pausar'}`)
    });
  }

  resumeDownload(download: Download) {
    this.downloadService.resumeDownload(download.id).subscribe({
      next: () => this.loadDownloads(),
      error: (err: any) => alert(`Error: ${err.error?.detail || 'No se pudo reanudar'}`)
    });
  }

  startDownloadNow(download: Download) {
    this.downloadService.startDownload(download.id).subscribe({
      next: () => this.loadDownloads(),
      error: (err: any) => alert(`Error: ${err.error?.detail || 'No se pudo iniciar'}`)
    });
  }

  setTopPriority(download: Download) {
    this.downloadService.setPriority(download.id, 100).subscribe({
      next: () => this.loadDownloads(),
      error: (err: any) => alert(`Error: ${err.error?.detail || 'No se pudo priorizar'}`)
    });
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
}
