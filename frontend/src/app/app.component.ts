import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StorageInfoComponent } from './components/storage-info/storage-info.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, StorageInfoComponent],
    template: `
    <div class="app-container">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="logo">
          <span class="logo-icon">📺</span>
          <span class="logo-text">IPTV Sync</span>
        </div>
        
        <nav class="nav">
          <a routerLink="/browse" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">🎬</span>
            <span>Explorar</span>
          </a>
          <a routerLink="/search" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">🔍</span>
            <span>Buscar</span>
          </a>
          <a routerLink="/downloads" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">⬇️</span>
            <span>Descargas</span>
          </a>
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
      width: 240px;
      background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-dark) 100%);
      border-right: 1px solid var(--border);
      padding: var(--spacing-lg);
      display: flex;
      flex-direction: column;
      position: fixed;
      height: 100vh;
    }
    
    .logo {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding-bottom: var(--spacing-lg);
      border-bottom: 1px solid var(--border);
      margin-bottom: var(--spacing-lg);
    }
    
    .logo-icon {
      font-size: 1.5rem;
    }
    
    .logo-text {
      font-size: 1.25rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--primary-light) 0%, var(--secondary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
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
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s ease;
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
    
    .nav-icon {
      font-size: 1.1rem;
    }
    
    .sidebar-footer {
      padding-top: var(--spacing-lg);
      border-top: 1px solid var(--border);
    }
    
    .main-content {
      flex: 1;
      margin-left: 240px;
      padding: var(--spacing-xl);
      min-height: 100vh;
    }
    
    @media (max-width: 768px) {
      .sidebar {
        width: 100%;
        height: auto;
        position: relative;
        flex-direction: row;
        padding: var(--spacing-md);
      }
      
      .nav {
        flex-direction: row;
      }
      
      .main-content {
        margin-left: 0;
      }
      
      .sidebar-footer {
        display: none;
      }
    }
  `]
})
export class AppComponent { }
