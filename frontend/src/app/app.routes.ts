import { Routes } from '@angular/router';
import { BrowseComponent } from './pages/browse/browse.component';
import { DownloadsComponent } from './pages/downloads/downloads.component';

export const routes: Routes = [
    { path: '', redirectTo: '/browse', pathMatch: 'full' },
    { path: 'browse', component: BrowseComponent },
    { path: 'downloads', component: DownloadsComponent }
];
