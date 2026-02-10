import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContentService } from '../../services/content.service';
import { DownloadService } from '../../services/download.service';
import { Movie, Series, DownloadCreate } from '../../models/content.model';
import { MovieCardComponent } from '../../components/movie-card/movie-card.component';

@Component({
    selector: 'app-search',
    standalone: true,
    imports: [CommonModule, FormsModule, MovieCardComponent],
    template: `
    <div class="search-page">
      <header class="page-header">
        <h1>Buscar</h1>
        <p class="text-secondary">Encuentra películas y series por nombre</p>
      </header>
      
      <!-- Search Bar -->
      <div class="search-bar">
        <input 
          type="text"
          class="input search-input"
          [(ngModel)]="searchQuery"
          (keyup.enter)="search()"
          placeholder="Escribe el nombre de una película o serie..."
          autofocus>
        <button class="btn btn-primary" (click)="search()" [disabled]="!searchQuery.trim()">
          🔍 Buscar
        </button>
      </div>
      
      <!-- Selection Bar -->
      <div class="selection-bar" *ngIf="selectedItems.length > 0">
        <span>{{ selectedItems.length }} seleccionado(s)</span>
        <button class="btn btn-primary" (click)="downloadSelected()">
          ⬇️ Descargar Seleccionados
        </button>
        <button class="btn btn-secondary" (click)="clearSelection()">
          ✖️ Limpiar
        </button>
      </div>
      
      <!-- Loading -->
      <div class="loading-state" *ngIf="loading">
        <div class="spinner"></div>
        <span>Buscando...</span>
      </div>
      
      <!-- Results -->
      <div class="results" *ngIf="!loading && hasSearched">
        <!-- Movies -->
        <section *ngIf="movies.length > 0">
          <h3 class="section-title">🎬 Películas ({{ movies.length }})</h3>
          <div class="content-grid">
            <app-movie-card 
              *ngFor="let movie of movies"
              [item]="movie"
              type="movies"
              [selected]="isSelected(movie)"
              (select)="toggleSelection(movie)"
              (download)="downloadItem(movie)">
            </app-movie-card>
          </div>
        </section>
        
        <!-- Series -->
        <section *ngIf="series.length > 0">
          <h3 class="section-title">📺 Series ({{ series.length }})</h3>
          <div class="content-grid">
            <app-movie-card 
              *ngFor="let s of series"
              [item]="s"
              type="series"
              [selected]="isSelected(s)"
              (select)="toggleSelection(s)"
              (download)="downloadItem(s)">
            </app-movie-card>
          </div>
        </section>
        
        <!-- No Results -->
        <div class="empty-state" *ngIf="movies.length === 0 && series.length === 0">
          <span class="empty-icon">🔍</span>
          <p>No se encontraron resultados para "{{ lastQuery }}"</p>
        </div>
      </div>
      
      <!-- Initial State -->
      <div class="initial-state" *ngIf="!loading && !hasSearched">
        <span class="initial-icon">🔍</span>
        <p>Escribe algo para buscar películas y series</p>
      </div>
    </div>
  `,
    styles: [`
    .search-page {
      max-width: 1400px;
    }
    
    .page-header {
      margin-bottom: var(--spacing-xl);
    }
    
    .search-bar {
      display: flex;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-xl);
    }
    
    .search-input {
      flex: 1;
      font-size: 1rem;
      padding: var(--spacing-md);
    }
    
    .selection-bar {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-md);
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      border-radius: var(--radius-lg);
      margin-bottom: var(--spacing-lg);
    }
    
    .selection-bar span {
      flex: 1;
      font-weight: 500;
    }
    
    .section-title {
      margin-bottom: var(--spacing-lg);
      padding-bottom: var(--spacing-sm);
      border-bottom: 1px solid var(--border);
    }
    
    section {
      margin-bottom: var(--spacing-xl);
    }
    
    .content-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--spacing-lg);
    }
    
    .loading-state, .empty-state, .initial-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);
      padding: 80px 20px;
      color: var(--text-secondary);
    }
    
    .empty-icon, .initial-icon {
      font-size: 4rem;
      opacity: 0.5;
    }
  `]
})
export class SearchComponent {
    searchQuery = '';
    lastQuery = '';
    movies: Movie[] = [];
    series: Series[] = [];
    selectedItems: (Movie | Series)[] = [];
    loading = false;
    hasSearched = false;

    constructor(
        private contentService: ContentService,
        private downloadService: DownloadService
    ) { }

    search() {
        if (!this.searchQuery.trim()) return;

        this.loading = true;
        this.lastQuery = this.searchQuery;

        this.contentService.search(this.searchQuery).subscribe({
            next: (result) => {
                this.movies = result.movies;
                this.series = result.series;
                this.loading = false;
                this.hasSearched = true;
            },
            error: (err) => {
                console.error('Error searching:', err);
                this.loading = false;
                this.hasSearched = true;
            }
        });
    }

    isSelected(item: Movie | Series): boolean {
        const id = 'stream_id' in item ? item.stream_id : item.series_id;
        return this.selectedItems.some(i => {
            const itemId = 'stream_id' in i ? i.stream_id : i.series_id;
            return itemId === id;
        });
    }

    toggleSelection(item: Movie | Series) {
        if (this.isSelected(item)) {
            const id = 'stream_id' in item ? item.stream_id : item.series_id;
            this.selectedItems = this.selectedItems.filter(i => {
                const itemId = 'stream_id' in i ? i.stream_id : i.series_id;
                return itemId !== id;
            });
        } else {
            this.selectedItems.push(item);
        }
    }

    clearSelection() {
        this.selectedItems = [];
    }

    downloadItem(item: Movie | Series) {
        if ('stream_id' in item) {
            const download: DownloadCreate = {
                stream_id: String(item.stream_id),
                title: item.name,
                content_type: 'MOVIE',
                poster_url: item.stream_icon,
                year: item.year,
                file_extension: item.container_extension || 'mp4'
            };

            this.downloadService.createDownload(download).subscribe({
                next: () => alert(`"${item.name}" agregado a la cola de descargas`),
                error: (err) => alert(`Error: ${err.error?.detail || 'No se pudo agregar'}`)
            });
        }
    }

    downloadSelected() {
        const downloads: DownloadCreate[] = this.selectedItems
            .filter(item => 'stream_id' in item)
            .map(item => {
                const movie = item as Movie;
                return {
                    stream_id: String(movie.stream_id),
                    title: movie.name,
                    content_type: 'MOVIE' as const,
                    poster_url: movie.stream_icon,
                    year: movie.year,
                    file_extension: movie.container_extension || 'mp4'
                };
            });

        if (downloads.length > 0) {
            this.downloadService.createBatchDownloads(downloads).subscribe({
                next: (result) => {
                    alert(`${result.length} elemento(s) agregados a la cola`);
                    this.clearSelection();
                },
                error: (err) => alert(`Error: ${err.error?.detail || 'No se pudo agregar'}`)
            });
        }
    }
}
