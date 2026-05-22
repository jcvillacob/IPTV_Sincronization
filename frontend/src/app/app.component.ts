import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Film, Search, Download, HardDrive, Heart, Clock, Tv, FolderDown } from 'lucide-angular';
import { StorageInfoComponent } from './components/storage-info/storage-info.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideAngularModule,
    StorageInfoComponent
  ],
  template: `
    <div class="app-container">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="logo">
          <div class="logo-icon-wrapper">
            <lucide-icon name="tv" [size]="24"></lucide-icon>
          </div>
          <span class="logo-text">IPTV<span class="text-gradient">Sync</span></span>
        </div>
        
        <nav class="nav">
          <a routerLink="/browse" routerLinkActive="active" class="nav-item">
            <lucide-icon name="film" [size]="20"></lucide-icon>
            <span>Explorar</span>
          </a>

          <div class="nav-section">
            <div class="nav-section-title">Descargas</div>
            <a routerLink="/downloads/queue" routerLinkActive="active" class="nav-item nav-sub-item">
              <lucide-icon name="download" [size]="18"></lucide-icon>
              <span>Cola</span>
              <span class="nav-badge" *ngIf="pendingCount > 0">{{ pendingCount }}</span>
            </a>
            <a routerLink="/downloads/library" routerLinkActive="active" class="nav-item nav-sub-item">
              <lucide-icon name="folder-down" [size]="18"></lucide-icon>
              <span>Descargados</span>
            </a>
          </div>
        </nav>
        
        <div class="sidebar-footer">
          <app-storage-info />
        </div>
      </aside>
      
      <!-- Main Content -->
      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      min-height: 100vh;
    }
    
    .sidebar {
      width: 260px;
      background: linear-gradient(180deg, var(--bg-card-solid) 0%, var(--bg-darker) 100%);
      border-right: 1px solid var(--border);
      padding: var(--spacing-xl);
      display: flex;
      flex-direction: column;
      position: fixed;
      height: 100vh;
      z-index: 100;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding-bottom: var(--spacing-xl);
      margin-bottom: var(--spacing-lg);
    }
    
    .logo-icon-wrapper {
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      border-radius: var(--radius-lg);
      color: white;
      box-shadow: var(--shadow-glow);
    }
    
    .logo-text {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.025em;
    }
    
    .nav {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
      flex: 1;
    }
    
    .nav-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: 0.875rem var(--spacing-lg);
      border-radius: var(--radius-lg);
      color: var(--text-secondary);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.9375rem;
      transition: all var(--transition-normal);
      position: relative;
    }
    
    .nav-item:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    
    .nav-item.active {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: white;
      box-shadow: var(--shadow-glow);
    }
    
    .nav-badge {
      margin-left: auto;
      min-width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--accent);
      color: white;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: var(--radius-full);
      padding: 0 6px;
    }
    
    .nav-item.active .nav-badge {
      background: rgba(255,255,255,0.25);
    }

    .nav-section {
      margin-top: var(--spacing-sm);
    }

    .nav-section-title {
      padding: 0 var(--spacing-md);
      margin: var(--spacing-sm) 0;
      color: var(--text-muted);
      font-size: 0.7rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
    }

    .nav-sub-item {
      padding-left: var(--spacing-md);
    }
    
    .sidebar-footer {
      padding-top: var(--spacing-lg);
      border-top: 1px solid var(--border);
    }
    
    .main-content {
      flex: 1;
      margin-left: 260px;
      padding: var(--spacing-xl) var(--spacing-2xl);
      min-height: 100vh;
    }
    
    @media (max-width: 1024px) {
      .sidebar {
        width: 220px;
        padding: var(--spacing-lg);
      }
      
      .main-content {
        margin-left: 220px;
        padding: var(--spacing-lg);
      }
    }
  `]
})
export class AppComponent {
  pendingCount = 0;

  // Icons for Lucide
  readonly icons = { Film, Search, Download, HardDrive, Heart, Clock, Tv, FolderDown };
}
