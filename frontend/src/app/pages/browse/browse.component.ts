import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription, interval, forkJoin, Subject, of } from 'rxjs';
import { startWith, switchMap, map, debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';
import { ContentService } from '../../services/content.service';
import { DownloadService } from '../../services/download.service';
import { Category, Movie, Series, SeriesDetail, DownloadCreate, Download } from '../../models/content.model';
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
            (input)="onSearchInput()"
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

        <div class="sort-controls">
          <select class="sort-select" [(ngModel)]="sortBy" (change)="filterContent()">
            <option value="name">Nombre</option>
            <option value="year">Año</option>
            <option value="rating">Valoración</option>
          </select>
          <select class="sort-select" [(ngModel)]="sortDirection" (change)="filterContent()">
            <option value="desc">Mayor a menor</option>
            <option value="asc">Menor a mayor</option>
          </select>
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
      
      <!-- Load More -->
      <div class="load-more-container" *ngIf="filteredItems.length < matchedItems.length">
        <button class="btn btn-primary" (click)="loadMore()">
            <lucide-icon name="plus" [size]="18"></lucide-icon>
            Cargar más ({{ matchedItems.length - filteredItems.length }} restantes)
        </button>
      </div>

      <!-- Results count -->
      <div class="results-info" *ngIf="!loading && filteredItems.length > 0">
        <span class="text-muted">
          Mostrando {{ filteredItems.length }} de {{ matchedItems.length }} resultados
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
      flex-wrap: wrap;
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

    .sort-controls {
      display: flex;
      gap: var(--spacing-sm);
      margin-left: auto;
    }

    .sort-select {
      min-width: 150px;
      height: 40px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background: var(--bg-input);
      color: var(--text-primary);
      padding: 0 0.625rem;
      font-size: 0.85rem;
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
      margin-top: var(--spacing-sm);
      text-align: center;
      font-size: 0.875rem;
    }

    .load-more-container {
        display: flex;
        justify-content: center;
        margin-top: var(--spacing-xl);
        margin-bottom: var(--spacing-md);
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

      .sort-controls {
        width: 100%;
        margin-left: 0;
      }

      .sort-select {
        flex: 1;
        min-width: 0;
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
  globalSearchItems: (Movie | Series)[] = [];
  usingGlobalSearch = false;
  filteredItems: (Movie | Series)[] = [];
  matchedItems: (Movie | Series)[] = []; // Store full results before pagination
  wishlist: (Movie | Series)[] = [];
  searchQuery = '';
  sortBy: 'name' | 'year' | 'rating' = 'name';
  sortDirection: 'asc' | 'desc' = 'desc';
  loading = false;
  displayLimit = 50;

  downloadSubscription?: Subscription;
  searchDebounceSubscription?: Subscription;
  searchInput$ = new Subject<string>();
  activeDownloads: Map<string, Download> = new Map();
  seriesDownloads: Map<string, Download[]> = new Map();

  constructor(
    private contentService: ContentService,
    private downloadService: DownloadService
  ) { }

  ngOnInit() {
    this.loadCategories();
    this.loadContent();
    this.startDownloadPolling();
    this.startSearchDebounce();
  }

  ngOnDestroy() {
    if (this.downloadSubscription) {
      this.downloadSubscription.unsubscribe();
    }
    if (this.searchDebounceSubscription) {
      this.searchDebounceSubscription.unsubscribe();
    }
  }

  startDownloadPolling() {
    this.downloadSubscription = interval(5000).pipe(
      startWith(0),
      switchMap(() => this.downloadService.getDownloads())
    ).subscribe({
      next: (downloads: Download[]) => {
        this.activeDownloads.clear();
        this.seriesDownloads.clear();
        downloads.forEach((d: Download) => {
          if (d.stream_id) {
            this.activeDownloads.set(d.stream_id, d);
          }
          if (d.content_type === 'EPISODE') {
            const key = this.getSeriesKeyFromDownload(d);
            if (!this.seriesDownloads.has(key)) this.seriesDownloads.set(key, []);
            this.seriesDownloads.get(key)!.push(d);
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

    const episodes = this.getSeriesEpisodes(item);
    if (episodes.length === 0) return undefined;

    const total = episodes.length;
    const completed = episodes.filter(ep => ep.status === 'COMPLETED').length;

    if (completed === total) return 'COMPLETED';
    if (episodes.some(ep => ep.status === 'DOWNLOADING')) return 'DOWNLOADING';
    if (episodes.some(ep => ep.status === 'SCHEDULED')) return 'SCHEDULED';
    return 'PENDING';
  }

  getDownloadProgress(item: Movie | Series): number {
    if ('stream_id' in item) {
      const download = this.activeDownloads.get(String(item.stream_id));
      return download ? download.progress : 0;
    }

    const episodes = this.getSeriesEpisodes(item);
    if (episodes.length === 0) return 0;
    const total = episodes.reduce((sum, ep) => sum + (ep.progress || 0), 0);
    return Math.round(total / episodes.length);
  }

  onSearchInput() {
    this.searchInput$.next(this.searchQuery);
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
      next: (cats: Category[]) => this.categories = cats,
      error: (err: any) => console.error('Error loading categories:', err)
    });
  }

  loadContent() {
    this.loading = true;
    this.searchQuery = ''; // Reset search on load
    this.usingGlobalSearch = false;
    this.globalSearchItems = [];
    this.displayLimit = 50; // Reset pagination
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
    const query = this.searchQuery.trim().toLowerCase();
    if (!query || query.length < 3) {
      this.usingGlobalSearch = false;
    }

    const sourceItems = this.usingGlobalSearch ? this.globalSearchItems : this.allItems;

    // Reset limit when searching to show fresh results
    if (this.searchQuery && this.filteredItems.length === this.matchedItems.length && this.displayLimit > 50) {
      this.displayLimit = 50;
    }

    if (!query) {
      this.matchedItems = [...sourceItems];
    } else {
      this.matchedItems = sourceItems
        .filter(item => item.name.toLowerCase().includes(query));
    }

    this.applySorting();
    this.updateDisplay();
  }

  private startSearchDebounce() {
    this.searchDebounceSubscription = this.searchInput$.pipe(
      map((q: string) => q.trim()),
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((query: string) => {
        if (!query) {
          this.usingGlobalSearch = false;
          this.globalSearchItems = [];
          this.loading = false;
          this.filterContent();
          return of(null);
        }

        if (query.length < 3) {
          this.usingGlobalSearch = false;
          this.globalSearchItems = [];
          this.loading = false;
          this.filterContent();
          return of(null);
        }

        this.loading = true;
        return this.contentService.search(query).pipe(
          map((result: any) => ({ query, result })),
          catchError((err: any) => {
            console.error('Error global search:', err);
            return of({ query, result: { movies: [], series: [] } });
          })
        );
      })
    ).subscribe((payload: any) => {
      if (!payload) {
        return;
      }

      const resultItems: (Movie | Series)[] = this.contentType === 'movies'
        ? payload.result.movies
        : payload.result.series;

      if (this.selectedCategory?.category_id) {
        const selectedCat = this.selectedCategory.category_id;
        this.globalSearchItems = resultItems.filter((item: Movie | Series) => {
          const categoryId = 'category_id' in item ? item.category_id : undefined;
          return String(categoryId || '') === String(selectedCat);
        });
      } else {
        this.globalSearchItems = resultItems;
      }

      this.usingGlobalSearch = true;
      this.matchedItems = [...this.globalSearchItems];
      this.displayLimit = 50;
      this.applySorting();
      this.updateDisplay();
      this.loading = false;
    });
  }

  updateDisplay() {
    this.filteredItems = this.matchedItems.slice(0, this.displayLimit);
  }

  loadMore() {
    this.displayLimit += 50;
    this.updateDisplay();
  }

  private applySorting() {
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    this.matchedItems.sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';

      if (this.sortBy === 'name') {
        aValue = (a.name || '').toLowerCase();
        bValue = (b.name || '').toLowerCase();
      } else if (this.sortBy === 'year') {
        aValue = this.getYearValue(a);
        bValue = this.getYearValue(b);
      } else {
        aValue = this.getRatingValue(a);
        bValue = this.getRatingValue(b);
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * direction;
      }

      return ((Number(aValue) - Number(bValue)) * direction);
    });
  }

  private getYearValue(item: Movie | Series): number {
    const raw = 'year' in item ? item.year : undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getRatingValue(item: Movie | Series): number {
    if ('stream_id' in item) {
      const movieRating = item.rating_5based ?? item.rating;
      const parsed = Number(movieRating);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    const seriesRating = Number(item.rating);
    return Number.isFinite(seriesRating) ? seriesRating : 0;
  }

  private getSeriesKeyFromSeries(series: Series): string {
    if (series.series_id !== undefined && series.series_id !== null) {
      return `id:${series.series_id}`;
    }
    return `name:${(series.name || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;
  }

  private getSeriesKeyFromDownload(download: Download): string {
    if (download.series_id !== undefined && download.series_id !== null) {
      return `id:${download.series_id}`;
    }
    return `name:${(download.series_name || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;
  }

  private getSeriesEpisodes(series: Series): Download[] {
    const byId = this.seriesDownloads.get(this.getSeriesKeyFromSeries(series)) || [];
    if (byId.length > 0) return byId;
    const byName = this.seriesDownloads.get(`name:${(series.name || '').trim().toLowerCase().replace(/\s+/g, ' ')}`) || [];
    return byName;
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
    const movies = items.filter(i => 'stream_id' in i) as Movie[];
    const seriesList = items.filter(i => !('stream_id' in i)) as Series[];

    const movieDownloads: DownloadCreate[] = movies.map(movie => ({
      stream_id: String(movie.stream_id),
      title: movie.name,
      content_type: 'MOVIE' as const,
      category_id: movie.category_id,
      poster_url: movie.stream_icon,
      year: movie.year,
      file_extension: movie.container_extension || 'mp4',
      scheduled: scheduled
    }));

    if (seriesList.length === 0) {
      this.sendDownloads(movieDownloads, scheduled);
      return;
    }

    const seriesRequests = seriesList.map(series =>
      this.contentService.getSeriesInfo(series.series_id).pipe(
        map((detail: SeriesDetail) => ({ series, detail }))
      )
    );

    forkJoin(seriesRequests).subscribe({
      next: (results: Array<{ series: Series; detail: SeriesDetail }>) => {
        const episodeDownloads: DownloadCreate[] = [];
        for (const { series, detail } of results) {
          for (const season of detail.seasons) {
            for (const episode of season.episodes) {
              episodeDownloads.push({
                stream_id: String(episode.id),
                title: episode.title || `Episodio ${episode.episode_num}`,
                content_type: 'EPISODE' as const,
                series_name: series.name,
                series_id: series.series_id,
                season: season.season_number,
                episode: episode.episode_num,
                category_id: series.category_id,
                poster_url: series.cover,
                file_extension: episode.container_extension || 'mkv',
                scheduled: scheduled
              });
            }
          }
        }
        this.sendDownloads([...movieDownloads, ...episodeDownloads], scheduled);
      },
      error: (err: any) => alert(`Error al obtener info de la serie: ${err.error?.detail || 'No se pudo obtener información'}`)
    });
  }

  private sendDownloads(downloads: DownloadCreate[], scheduled: boolean) {
    if (downloads.length === 0) return;
    this.downloadService.createBatchDownloads(downloads).subscribe({
      next: (result: any) => {
        const msg = scheduled
          ? `${result.length} elemento(s) programados para 1 AM`
          : `${result.length} elemento(s) agregados a descarga`;
        alert(msg);
      },
      error: (err: any) => alert(`Error: ${err.error?.detail || 'No se pudo agregar'}`)
    });
  }
}
