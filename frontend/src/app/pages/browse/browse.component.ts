import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContentService } from '../../services/content.service';
import { DownloadService } from '../../services/download.service';
import { Category, Movie, Series, DownloadCreate } from '../../models/content.model';
import { MovieCardComponent } from '../../components/movie-card/movie-card.component';

@Component({
    selector: 'app-browse',
    standalone: true,
    imports: [CommonModule, MovieCardComponent],
    template: `
    <div class="browse-page">
      <header class="page-header">
        <h1>Explorar Contenido</h1>
        <p class="text-secondary">Navega por categorías de películas y series</p>
      </header>
      
      <!-- Type Tabs -->
      <div class="type-tabs">
        <button 
          class="tab" 
          [class.active]="contentType === 'movies'"
          (click)="setContentType('movies')">
          🎬 Películas
        </button>
        <button 
          class="tab" 
          [class.active]="contentType === 'series'"
          (click)="setContentType('series')">
          📺 Series
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
      
      <!-- Categories -->
      <div class="categories-section">
        <div class="categories-scroll">
          <button 
            class="category-chip"
            [class.active]="!selectedCategory"
            (click)="selectCategory(null)">
            Todos
          </button>
          <button 
            *ngFor="let cat of categories"
            class="category-chip"
            [class.active]="selectedCategory?.category_id === cat.category_id"
            (click)="selectCategory(cat)">
            {{ cat.category_name }}
          </button>
        </div>
      </div>
      
      <!-- Loading -->
      <div class="loading-state" *ngIf="loading">
        <div class="spinner"></div>
        <span>Cargando contenido...</span>
      </div>
      
      <!-- Content Grid -->
      <div class="content-grid" *ngIf="!loading">
        <app-movie-card 
          *ngFor="let item of displayItems"
          [item]="item"
          [type]="contentType"
          [selected]="isSelected(item)"
          (select)="toggleSelection(item)"
          (download)="downloadItem(item)">
        </app-movie-card>
      </div>
      
      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && displayItems.length === 0">
        <span class="empty-icon">📭</span>
        <p>No hay contenido disponible</p>
      </div>
    </div>
  `,
    styles: [`
    .browse-page {
      max-width: 1400px;
    }
    
    .page-header {
      margin-bottom: var(--spacing-xl);
    }
    
    .page-header h1 {
      margin-bottom: var(--spacing-xs);
    }
    
    .type-tabs {
      display: flex;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-lg);
    }
    
    .tab {
      padding: var(--spacing-sm) var(--spacing-lg);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      color: var(--text-secondary);
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .tab:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    
    .tab.active {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }
    
    .selection-bar {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-md);
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      border-radius: var(--radius-lg);
      margin-bottom: var(--spacing-lg);
      animation: fadeIn 0.3s ease;
    }
    
    .selection-bar span {
      flex: 1;
      font-weight: 500;
    }
    
    .categories-section {
      margin-bottom: var(--spacing-lg);
    }
    
    .categories-scroll {
      display: flex;
      gap: var(--spacing-sm);
      overflow-x: auto;
      padding-bottom: var(--spacing-sm);
    }
    
    .category-chip {
      flex-shrink: 0;
      padding: var(--spacing-xs) var(--spacing-md);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      color: var(--text-secondary);
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    
    .category-chip:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    
    .category-chip.active {
      background: var(--secondary);
      border-color: var(--secondary);
      color: white;
    }
    
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-xl) * 2;
      color: var(--text-secondary);
    }
    
    .content-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--spacing-lg);
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
export class BrowseComponent implements OnInit {
    contentType: 'movies' | 'series' = 'movies';
    categories: Category[] = [];
    selectedCategory: Category | null = null;
    movies: Movie[] = [];
    series: Series[] = [];
    selectedItems: (Movie | Series)[] = [];
    loading = false;

    constructor(
        private contentService: ContentService,
        private downloadService: DownloadService
    ) { }

    ngOnInit() {
        this.loadCategories();
        this.loadContent();
    }

    get displayItems(): (Movie | Series)[] {
        return this.contentType === 'movies' ? this.movies : this.series;
    }

    setContentType(type: 'movies' | 'series') {
        this.contentType = type;
        this.clearSelection();
        this.loadCategories();
        this.loadContent();
    }

    selectCategory(category: Category | null) {
        this.selectedCategory = category;
        this.loadContent();
    }

    loadCategories() {
        const request = this.contentType === 'movies'
            ? this.contentService.getMovieCategories()
            : this.contentService.getSeriesCategories();

        request.subscribe({
            next: (cats) => this.categories = cats.slice(0, 30), // Limit categories
            error: (err) => console.error('Error loading categories:', err)
        });
    }

    loadContent() {
        this.loading = true;
        const categoryId = this.selectedCategory?.category_id;

        if (this.contentType === 'movies') {
            this.contentService.getMovies(categoryId).subscribe({
                next: (movies) => {
                    this.movies = movies.slice(0, 100); // Limit for performance
                    this.loading = false;
                },
                error: (err) => {
                    console.error('Error loading movies:', err);
                    this.loading = false;
                }
            });
        } else {
            this.contentService.getSeries(categoryId).subscribe({
                next: (series) => {
                    this.series = series.slice(0, 100);
                    this.loading = false;
                },
                error: (err) => {
                    console.error('Error loading series:', err);
                    this.loading = false;
                }
            });
        }
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
                content_type: 'movie',
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
                    content_type: 'movie' as const,
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
