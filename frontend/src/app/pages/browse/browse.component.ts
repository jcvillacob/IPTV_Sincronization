import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription, interval } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { ContentService } from '../../services/content.service';
import { DownloadService } from '../../services/download.service';
import { Category, Movie, Series, DownloadCreate, Download } from '../../models/content.model';
import { MovieCardComponent } from '../../components/movie-card/movie-card.component';

@Component({
  selector: 'app-browse',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, MovieCardComponent],
  template: `
    <div class="browse-page">
      <!-- Header -->
      <header class="page-header">
        <div class="header-content">
          <h1>Explorar <span class="text-gradient">Contenido</span></h1>
          <p class="text-secondary">Busca y selecciona películas y series para descargar</p>
        </div>
      </header>
      
      <!-- Search & Filters Bar -->
      <div class="search-filters-bar glass">
        <div class="search-wrapper">
          <lucide-icon name="search" [size]="20" class="search-icon"></lucide-icon>
          <input 
            type="text"
            class="input input-lg"
            [(ngModel)]="searchQuery"
            (input)="filterContent()"
            placeholder="Buscar por nombre...">
        </div>
        
        <div class="type-toggle">
          <button 
            class="toggle-btn" 
            [class.active]="contentType === 'movies'"
            (click)="setContentType('movies')">
            <lucide-icon name="film" [size]="18"></lucide-icon>
            Películas
          </button>
          <button 
            class="toggle-btn" 
            [class.active]="contentType === 'series'"
            (click)="setContentType('series')">
            <lucide-icon name="tv" [size]="18"></lucide-icon>
            Series
          </button>
        </div>
      </div>
      
      <!-- Categories Scroll -->
      <div class="categories-section">
        <div class="categories-scroll">
          <button 
            class="chip"
            [class.active]="!selectedCategory"
            (click)="selectCategory(null)">
            Todas
          </button>
          <button 
            *ngFor="let cat of categories"
            class="chip"
            [class.active]="selectedCategory?.category_id === cat.category_id"
            (click)="selectCategory(cat)">
            {{ cat.category_name }}
          </button>
        </div>
      </div>
      
      <!-- Selection/Wishlist Bar -->
      <div class="selection-bar glass" *ngIf="wishlist.length > 0" @fadeIn>
        <div class="selection-info">
          <lucide-icon name="heart" [size]="20"></lucide-icon>
          <span><strong>{{ wishlist.length }}</strong> en lista de deseos</span>
        </div>
        <div class="selection-actions">
          <button class="btn btn-success" (click)="downloadNow()">
            <lucide-icon name="download" [size]="18"></lucide-icon>
            Descargar Ahora
          </button>
          <button class="btn btn-warning" (click)="scheduleDownload()">
            <lucide-icon name="clock" [size]="18"></lucide-icon>
            Programar 1 AM
          </button>
          <button class="btn btn-ghost" (click)="clearWishlist()">
            <lucide-icon name="x" [size]="18"></lucide-icon>
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
          *ngFor="let item of filteredItems; let i = index"
          [item]="item"
          [type]="contentType"
          [inWishlist]="isInWishlist(item)"
          [downloadStatus]="getDownloadStatus(item)"
          [downloadProgress]="getDownloadProgress(item)"
          [style.animation-delay.ms]="i * 30"
          (addToWishlist)="toggleWishlist(item)"
          (downloadNow)="downloadSingleItem(item)"
          (scheduleDownload)="scheduleSingleItem(item)">
        </app-movie-card>
      </div>
      
      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && filteredItems.length === 0">
        <lucide-icon name="search" [size]="64" class="empty-state-icon"></lucide-icon>
        <h3>No se encontraron resultados</h3>
        <p class="text-muted" *ngIf="searchQuery">
          No hay coincidencias para "{{ searchQuery }}"
        </p>
        <p class="text-muted" *ngIf="!searchQuery">
          Esta categoría no tiene contenido disponible
        </p>
      </div>
      
      <!-- Results count -->
      <div class="results-info" *ngIf="!loading && filteredItems.length > 0">
        <span class="text-muted">
          Mostrando {{ filteredItems.length }} de {{ allItems.length }} resultados
        </span>
      </div>
    </div>
  `,
  styles: [`
    .browse-page {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .page-header {
      margin-bottom: var(--spacing-xl);
    }
    
    .header-content h1 {
      margin-bottom: var(--spacing-xs);
    }
    
    .search-filters-bar {
      display: flex;
      gap: var(--spacing-lg);
      padding: var(--spacing-lg);
      border-radius: var(--radius-xl);
      margin-bottom: var(--spacing-lg);
      align-items: center;
    }
    
    .search-wrapper {
      flex: 1;
      position: relative;
    }
    
    .search-wrapper .search-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }
    
    .search-wrapper .input {
      padding-left: 4rem;
      background: var(--bg-input);
      width: 100%;
    }
    
    .type-toggle {
      display: flex;
      background: var(--bg-input);
      border-radius: var(--radius-lg);
      padding: 4px;
      flex-shrink: 0;
    }
    
    .toggle-btn {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: 0.625rem 1.25rem;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-weight: 500;
      font-size: 0.875rem;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    
    .toggle-btn:hover {
      color: var(--text-primary);
    }
    
    .toggle-btn.active {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: white;
      box-shadow: var(--shadow-sm);
    }
    
    .categories-section {
      margin-bottom: var(--spacing-lg);
    }
    
    .categories-scroll {
      display: flex;
      gap: var(--spacing-sm);
      overflow-x: auto;
      padding-bottom: var(--spacing-sm);
      scrollbar-width: none;
    }
    
    .categories-scroll::-webkit-scrollbar {
      display: none;
    }
    
    .selection-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-md) var(--spacing-lg);
      border-radius: var(--radius-lg);
      margin-bottom: var(--spacing-lg);
      border: 1px solid var(--primary);
      background: rgba(139, 92, 246, 0.1);
    }
    
    .selection-info {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      color: var(--primary-light);
    }
    
    .selection-actions {
      display: flex;
      gap: var(--spacing-sm);
    }
    
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-lg);
      padding: 80px 20px;
      color: var(--text-secondary);
    }
    
    .content-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--spacing-lg);
      justify-content: center;
    }
    
    .content-grid > * {
      animation: fadeInUp 0.4s ease forwards;
      opacity: 0;
    }
    
    .empty-state {
      padding: 80px 20px;
    }
    
    .empty-state h3 {
      margin-bottom: var(--spacing-sm);
    }
    
    .results-info {
      margin-top: var(--spacing-xl);
      text-align: center;
      font-size: 0.875rem;
    }
    
    @media (max-width: 768px) {
      .search-filters-bar {
        flex-direction: column;
        align-items: stretch;
      }
      
      .search-wrapper {
        width: 100%;
      }
      
      .type-toggle {
        width: 100%;
      }
       
      .toggle-btn {
        flex: 1;
        justify-content: center;
      }
      
      .selection-bar {
        flex-direction: column;
        gap: var(--spacing-md);
      }
      
      .selection-actions {
        width: 100%;
        justify-content: center;
        flex-wrap: wrap;
      }
    }
  `]
})
export class BrowseComponent implements OnInit, OnDestroy {
  contentType: 'movies' | 'series' = 'movies';
  categories: Category[] = [];
  selectedCategory: Category | null = null;
  allItems: (Movie | Series)[] = [];
  filteredItems: (Movie | Series)[] = [];
  wishlist: (Movie | Series)[] = [];
  searchQuery = '';
  loading = false;

  downloadSubscription?: Subscription;
  activeDownloads: Map<string, Download> = new Map();

  constructor(
    private contentService: ContentService,
    private downloadService: DownloadService
  ) { }

  ngOnInit() {
    this.loadCategories();
    this.loadContent();
    this.startDownloadPolling();
  }

  ngOnDestroy() {
    if (this.downloadSubscription) {
      this.downloadSubscription.unsubscribe();
    }
  }

  startDownloadPolling() {
    this.downloadSubscription = interval(5000).pipe(
      startWith(0),
      switchMap(() => this.downloadService.getDownloads())
    ).subscribe({
      next: (downloads: Download[]) => {
        this.activeDownloads.clear();
        downloads.forEach((d: Download) => {
          if (d.stream_id) {
            this.activeDownloads.set(d.stream_id, d);
          }
        });
      },
      error: (err: any) => console.error('Error polling downloads:', err)
    });
  }

  getDownloadStatus(item: Movie | Series): string | undefined {
    if ('stream_id' in item) {
      const download = this.activeDownloads.get(String(item.stream_id));
      return download ? download.status : undefined;
    }
    return undefined;
  }

  getDownloadProgress(item: Movie | Series): number {
    if ('stream_id' in item) {
      const download = this.activeDownloads.get(String(item.stream_id));
      return download ? download.progress : 0;
    }
    return 0;
  }


  setContentType(type: 'movies' | 'series') {
    this.contentType = type;
    this.searchQuery = '';
    this.selectedCategory = null;
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
      next: (cats: Category[]) => this.categories = cats.slice(0, 25),
      error: (err: any) => console.error('Error loading categories:', err)
    });
  }

  loadContent() {
    this.loading = true;
    this.searchQuery = ''; // Reset search on load
    const categoryId = this.selectedCategory?.category_id;

    // Use specific type based on contentType but handle as union
    if (this.contentType === 'movies') {
      this.contentService.getMovies(categoryId).subscribe({
        next: (items: Movie[]) => {
          this.allItems = items;
          this.filterContent();
          this.loading = false;
        },
        error: (err: any) => {
          console.error('Error loading content:', err);
          this.loading = false;
        }
      });
    } else {
      this.contentService.getSeries(categoryId).subscribe({
        next: (items: Series[]) => {
          this.allItems = items;
          this.filterContent();
          this.loading = false;
        },
        error: (err: any) => {
          console.error('Error loading content:', err);
          this.loading = false;
        }
      });
    }
  }

  filterContent() {
    if (!this.searchQuery.trim()) {
      this.filteredItems = this.allItems.slice(0, 100);
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredItems = this.allItems
      .filter(item => item.name.toLowerCase().includes(query))
      .slice(0, 100);
  }

  isInWishlist(item: Movie | Series): boolean {
    const id = 'stream_id' in item ? item.stream_id : item.series_id;
    return this.wishlist.some(i => {
      const itemId = 'stream_id' in i ? i.stream_id : i.series_id;
      return itemId === id;
    });
  }

  toggleWishlist(item: Movie | Series) {
    if (this.isInWishlist(item)) {
      const id = 'stream_id' in item ? item.stream_id : item.series_id;
      this.wishlist = this.wishlist.filter(i => {
        const itemId = 'stream_id' in i ? i.stream_id : i.series_id;
        return itemId !== id;
      });
    } else {
      this.wishlist.push(item);
    }
  }

  clearWishlist() {
    this.wishlist = [];
  }

  downloadNow() {
    this.downloadItems(this.wishlist, false);
    this.clearWishlist();
  }

  scheduleDownload() {
    this.downloadItems(this.wishlist, true);
    this.clearWishlist();
  }

  downloadSingleItem(item: Movie | Series) {
    this.downloadItems([item], false);
  }

  scheduleSingleItem(item: Movie | Series) {
    this.downloadItems([item], true);
  }

  private downloadItems(items: (Movie | Series)[], scheduled: boolean) {
    // Only support movies for now in this batch helper, or expand backend to handle both
    // The DownloadCreate model supports content_type, but here we assume movies from browse?
    // Actually the browse supports both.

    const downloads: DownloadCreate[] = items
      .map(item => {
        if ('stream_id' in item) {
          // Movie
          const movie = item as Movie;
          return {
            stream_id: String(movie.stream_id),
            title: movie.name,
            content_type: 'movie' as const,
            poster_url: movie.stream_icon,
            year: movie.year,
            file_extension: movie.container_extension || 'mp4',
            scheduled: scheduled
          } as DownloadCreate;
        } else {
          return null;
        }
      })
      .filter((item): item is DownloadCreate => item !== null);

    if (downloads.length > 0) {
      this.downloadService.createBatchDownloads(downloads).subscribe({
        next: (result: any) => {
          const msg = scheduled
            ? `${result.length} elemento(s) programados para 1 AM`
            : `${result.length} elemento(s) agregados a descarga`;
          alert(msg);
        },
        error: (err: any) => alert(`Error: ${err.error?.detail || 'No se pudo agregar'}`)
      });
    } else {
      if (items.some(i => !('stream_id' in i))) {
        alert('Por ahora solo se pueden descargar películas directamente.');
      }
    }
  }
}
