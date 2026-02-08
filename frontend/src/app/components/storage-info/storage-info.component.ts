import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageService } from '../../services/storage.service';
import { StorageInfo } from '../../models/content.model';

@Component({
    selector: 'app-storage-info',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="storage-info" *ngIf="storageInfo">
      <div class="storage-header">
        <span class="storage-icon">💾</span>
        <span>USB</span>
      </div>
      <div class="storage-bar">
        <div class="storage-bar-fill" [style.width.%]="storageInfo.percent_used"></div>
      </div>
      <div class="storage-details">
        <span>{{ storageInfo.free_gb }} GB libres</span>
        <span class="text-muted">de {{ storageInfo.total_gb }} GB</span>
      </div>
    </div>
  `,
    styles: [`
    .storage-info {
      padding: var(--spacing-md);
      background: var(--bg-input);
      border-radius: var(--radius-md);
    }
    
    .storage-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: var(--spacing-sm);
    }
    
    .storage-icon {
      font-size: 1rem;
    }
    
    .storage-bar {
      height: 6px;
      background: var(--bg-dark);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: var(--spacing-sm);
    }
    
    .storage-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--success) 0%, var(--warning) 70%, var(--error) 100%);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    
    .storage-details {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
    }
  `]
})
export class StorageInfoComponent implements OnInit {
    storageInfo: StorageInfo | null = null;

    constructor(private storageService: StorageService) { }

    ngOnInit() {
        this.loadStorageInfo();
        // Refresh every 30 seconds
        setInterval(() => this.loadStorageInfo(), 30000);
    }

    loadStorageInfo() {
        this.storageService.getStorageInfo().subscribe({
            next: (info) => this.storageInfo = info,
            error: (err) => console.error('Error loading storage info:', err)
        });
    }
}
