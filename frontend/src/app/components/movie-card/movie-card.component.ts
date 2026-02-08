import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Movie, Series } from '../../models/content.model';

@Component({
    selector: 'app-movie-card',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="movie-card" [class.selected]="selected" (click)="select.emit()">
      <div class="poster-container">
        <img 
          [src]="posterUrl" 
          [alt]="itemName"
          class="poster"
          (error)="onImageError($event)">
        <div class="overlay">
          <button class="btn-download" (click)="onDownload($event)">
            ⬇️
          </button>
        </div>
        <div class="selection-indicator" *ngIf="selected">
          ✓
        </div>
      </div>
      <div class="card-info">
        <h4 class="title" [title]="itemName">{{ itemName }}</h4>
        <span class="year" *ngIf="itemYear">{{ itemYear }}</span>
      </div>
    </div>
  `,
    styles: [`
    .movie-card {
      cursor: pointer;
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--bg-card);
      border: 2px solid transparent;
      transition: all 0.2s ease;
    }
    
    .movie-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
      border-color: var(--border-light);
    }
    
    .movie-card.selected {
      border-color: var(--primary);
      box-shadow: var(--shadow-glow);
    }
    
    .poster-container {
      position: relative;
      aspect-ratio: 2/3;
      overflow: hidden;
    }
    
    .poster {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
    
    .movie-card:hover .poster {
      transform: scale(1.05);
    }
    
    .overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: var(--spacing-md);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .movie-card:hover .overlay {
      opacity: 1;
    }
    
    .btn-download {
      padding: var(--spacing-sm) var(--spacing-lg);
      background: var(--primary);
      border: none;
      border-radius: var(--radius-md);
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .btn-download:hover {
      background: var(--primary-dark);
      transform: scale(1.1);
    }
    
    .selection-indicator {
      position: absolute;
      top: var(--spacing-sm);
      right: var(--spacing-sm);
      width: 24px;
      height: 24px;
      background: var(--primary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: bold;
      color: white;
      animation: fadeIn 0.2s ease;
    }
    
    .card-info {
      padding: var(--spacing-sm) var(--spacing-md);
    }
    
    .title {
      font-size: 0.875rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }
    
    .year {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
  `]
})
export class MovieCardComponent {
    @Input() item!: Movie | Series;
    @Input() type: 'movies' | 'series' = 'movies';
    @Input() selected = false;
    @Output() select = new EventEmitter<void>();
    @Output() download = new EventEmitter<void>();

    get posterUrl(): string {
        if ('stream_icon' in this.item) {
            return this.item.stream_icon || 'assets/no-poster.png';
        }
        return (this.item as Series).cover || 'assets/no-poster.png';
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

    onImageError(event: Event) {
        const img = event.target as HTMLImageElement;
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150"><rect fill="%231a1a2e" width="100" height="150"/><text x="50" y="75" text-anchor="middle" fill="%2364748b" font-size="12">Sin imagen</text></svg>';
    }

    onDownload(event: Event) {
        event.stopPropagation();
        this.download.emit();
    }
}
