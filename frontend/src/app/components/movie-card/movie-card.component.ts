import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Movie, Series } from '../../models/content.model';

@Component({
  selector: 'app-movie-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="movie-card" [class.in-wishlist]="inWishlist">
      <div class="poster-container">
        <img 
          [src]="posterUrl" 
          [alt]="itemName"
          class="poster"
          loading="lazy"
          (error)="onImageError($event)">
        
        <!-- Overlay with actions -->
        <div class="overlay" 
             [class.downloading]="downloadStatus === 'downloading'"
             [class.active-status]="downloadStatus && downloadStatus !== 'downloading'">
          
          <!-- Download Progress State -->
          <div class="download-state" *ngIf="downloadStatus === 'downloading'">
            <div class="progress-circle">
              <span class="progress-value">{{ downloadProgress }}%</span>
              <svg viewBox="0 0 36 36" class="circular-chart">
                <path class="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path class="circle"
                  [attr.stroke-dasharray]="downloadProgress + ', 100'"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <span class="status-text">Descargando...</span>
          </div>

          <!-- Completed State -->
          <div class="download-state" *ngIf="downloadStatus === 'completed'">
            <div class="status-icon success">
              <lucide-icon name="check" [size]="32"></lucide-icon>
            </div>
            <span class="status-text">Completado</span>
          </div>

          <!-- Pending/Scheduled State -->
          <div class="download-state" *ngIf="downloadStatus === 'pending' || downloadStatus === 'scheduled'">
             <div class="status-icon warning">
              <lucide-icon [name]="downloadStatus === 'scheduled' ? 'calendar-clock' : 'clock'" [size]="32"></lucide-icon>
            </div>
            <span class="status-text">{{ downloadStatus === 'scheduled' ? 'Programado' : 'Pendiente' }}</span>
          </div>
          
          <!-- Default Actions (only if not downloading/completed) -->
          <div class="overlay-actions" *ngIf="!downloadStatus">
            <button 
              class="action-btn primary" 
              (click)="onDownloadNow($event)"
              title="Descargar ahora">
              <lucide-icon name="download" [size]="20"></lucide-icon>
            </button>
            <button 
              class="action-btn secondary" 
              (click)="onSchedule($event)"
              title="Programar 1 AM">
              <lucide-icon name="clock" [size]="20"></lucide-icon>
            </button>
          </div>
        </div>
        
        <!-- Wishlist button -->
        <button 
          class="wishlist-btn"
          [class.active]="inWishlist"
          (click)="onWishlistToggle($event)"
          [title]="inWishlist ? 'Quitar de lista' : 'Agregar a lista'">
          <lucide-icon name="heart" [size]="18"></lucide-icon>
        </button>
        
        <!-- Rating badge -->
        <div class="rating-badge" *ngIf="itemRating">
          <lucide-icon name="star" [size]="12"></lucide-icon>
          {{ itemRating }}
        </div>
      </div>
      
      <div class="card-info">
        <h4 class="title" [title]="itemName">{{ itemName }}</h4>
        <div class="meta">
          <span class="year" *ngIf="itemYear">{{ itemYear }}</span>
          <span class="extension badge-purple" *ngIf="itemExtension">{{ itemExtension }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .movie-card {
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--bg-card);
      border: 2px solid transparent;
      transition: all var(--transition-normal);
    }
    
    .movie-card:hover {
      transform: translateY(-6px);
      box-shadow: var(--shadow-lg);
      border-color: var(--border-light);
    }
    
    .movie-card.in-wishlist {
      border-color: var(--accent);
      box-shadow: 0 0 20px rgba(244, 114, 182, 0.2);
    }
    
    .poster-container {
      position: relative;
      aspect-ratio: 2/3;
      overflow: hidden;
      background: var(--bg-darker);
    }
    
    .poster {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform var(--transition-slow);
    }
    
    .movie-card:hover .poster {
      transform: scale(1.08);
    }
    
    .overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        rgba(0, 0, 0, 0.9) 0%,
        rgba(0, 0, 0, 0.4) 40%,
        transparent 70%
      );
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: var(--spacing-lg);
      opacity: 0;
      transition: opacity var(--transition-normal);
      backdrop-filter: blur(0px);
    }
    
    .movie-card:hover .overlay, .overlay.downloading, .overlay.active-status {
      opacity: 1;
    }

    .overlay.downloading, .overlay.active-status {
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(2px);
      align-items: center;
    }
    
    .download-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      color: white;
    }

    .progress-circle {
      position: relative;
      width: 60px;
      height: 60px;
    }

    .circular-chart {
      display: block;
      margin: 0 auto;
      max-width: 100%;
      max-height: 100%;
    }

    .circle-bg {
      fill: none;
      stroke: rgba(255, 255, 255, 0.2);
      stroke-width: 3.8;
    }

    .circle {
      fill: none;
      stroke: var(--secondary);
      stroke-width: 2.8;
      stroke-linecap: round;
      animation: progress 1s ease-out forwards;
    }

    .progress-value {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 0.8rem;
      font-weight: bold;
      color: white;
    }

    .status-text {
      font-size: 0.875rem;
      font-weight: 500;
    }

    .status-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
    }

    .status-icon.success {
      background: rgba(16, 185, 129, 0.2);
      color: var(--success);
    }

    .status-icon.warning {
      background: rgba(245, 158, 11, 0.2);
      color: var(--warning);
    }
    
    .overlay-actions {
      display: flex;
      gap: var(--spacing-sm);
    }
    
    .action-btn {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all var(--transition-fast);
      color: white;
    }
    
    .action-btn.primary {
      background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
    }
    
    .action-btn.primary:hover {
      transform: scale(1.1);
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
    }
    
    .action-btn.secondary {
      background: linear-gradient(135deg, var(--warning) 0%, #d97706 100%);
    }
    
    .action-btn.secondary:hover {
      transform: scale(1.1);
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.5);
    }
    
    .wishlist-btn {
      position: absolute;
      top: var(--spacing-sm);
      right: var(--spacing-sm);
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(10px);
      border: none;
      border-radius: var(--radius-full);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
      opacity: 0;
    }
    
    .movie-card:hover .wishlist-btn {
      opacity: 1;
    }
    
    .wishlist-btn:hover {
      background: var(--accent);
      color: white;
      transform: scale(1.1);
    }
    
    .wishlist-btn.active {
      opacity: 1;
      background: var(--accent);
      color: white;
      animation: pulse 1.5s ease-in-out infinite;
    }
    
    .rating-badge {
      position: absolute;
      top: var(--spacing-sm);
      left: var(--spacing-sm);
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(10px);
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--warning);
    }
    
    .card-info {
      padding: var(--spacing-md);
    }
    
    .title {
      font-size: 0.9rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
      color: var(--text-primary);
    }
    
    .meta {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }
    
    .year {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    
    .extension {
      font-size: 0.625rem;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      background: rgba(139, 92, 246, 0.15);
      color: var(--primary-light);
    }
  `]
})
export class MovieCardComponent {
  @Input() item!: Movie | Series;
  @Input() type: 'movies' | 'series' = 'movies';
  @Input() inWishlist = false;
  @Input() downloadStatus: string | undefined;
  @Input() downloadProgress: number = 0;

  @Output() addToWishlist = new EventEmitter<void>();
  @Output() downloadNow = new EventEmitter<void>();
  @Output() scheduleDownload = new EventEmitter<void>();

  get posterUrl(): string {
    if ('stream_icon' in this.item) {
      return this.item.stream_icon || '';
    }
    return (this.item as Series).cover || '';
  }

  get itemName(): string {
    return this.item.name;
  }

  get itemYear(): string | undefined {
    if ('year' in this.item) {
      return this.item.year;
    }
    return undefined;
  }

  get itemRating(): string | undefined {
    if ('rating' in this.item && this.item.rating) {
      return String(this.item.rating);
    }
    return undefined;
  }

  get itemExtension(): string | undefined {
    if ('container_extension' in this.item) {
      return this.item.container_extension;
    }
    return undefined;
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect fill="%230f0f19" width="200" height="300"/><text x="100" y="150" text-anchor="middle" fill="%2364748b" font-family="system-ui" font-size="14">Sin imagen</text></svg>';
  }

  onWishlistToggle(event: Event) {
    event.stopPropagation();
    this.addToWishlist.emit();
  }

  onDownloadNow(event: Event) {
    event.stopPropagation();
    this.downloadNow.emit();
  }

  onSchedule(event: Event) {
    event.stopPropagation();
    this.scheduleDownload.emit();
  }
}
