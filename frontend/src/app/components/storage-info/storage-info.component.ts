import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { StorageService } from '../../services/storage.service';
import { StorageInfo } from '../../models/content.model';

@Component({
  selector: 'app-storage-info',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="storage-info" *ngIf="storageInfo">
      <div class="storage-header">
        <lucide-icon name="hard-drive" [size]="16"></lucide-icon>
        <span>Almacenamiento USB</span>
      </div>
      <div class="storage-bar">
        <div 
          class="storage-bar-fill" 
          [style.width.%]="storageInfo.percent_used"
          [class.warning]="storageInfo.percent_used > 70"
          [class.danger]="storageInfo.percent_used > 90">
        </div>
      </div>
      <div class="storage-details">
        <span class="free">{{ storageInfo.free_gb }} GB libres</span>
        <span class="total">{{ storageInfo.total_gb }} GB</span>
      </div>
    </div>
  `,
  styles: [`
    .storage-info {
      padding: var(--spacing-md);
      background: var(--bg-input);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
    }
    
    .storage-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: var(--spacing-sm);
    }
    
    .storage-bar {
      height: 6px;
      background: var(--bg-darker);
      border-radius: var(--radius-full);
      overflow: hidden;
      margin-bottom: var(--spacing-sm);
    }
    
    .storage-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--success) 0%, var(--success-light) 100%);
      border-radius: var(--radius-full);
      transition: all var(--transition-slow);
    }
    
    .storage-bar-fill.warning {
      background: linear-gradient(90deg, var(--warning) 0%, var(--warning-light) 100%);
    }
    
    .storage-bar-fill.danger {
      background: linear-gradient(90deg, var(--error) 0%, var(--error-light) 100%);
    }
    
    .storage-details {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
    }
    
    .free {
      color: var(--text-primary);
      font-weight: 500;
    }
    
    .total {
      color: var(--text-muted);
    }
  `]
})
export class StorageInfoComponent implements OnInit {
  storageInfo: StorageInfo | null = null;

  constructor(private storageService: StorageService) { }

  ngOnInit() {
    this.loadStorageInfo();
    setInterval(() => this.loadStorageInfo(), 30000);
  }

  loadStorageInfo() {
    this.storageService.getStorageInfo().subscribe({
      next: (info) => this.storageInfo = info,
      error: (err) => console.error('Error loading storage info:', err)
    });
  }
}
