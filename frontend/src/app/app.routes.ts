import { Routes } from '@angular/router';
import { BrowseComponent } from './pages/browse/browse.component';
import { QueueDownloadsComponent } from './pages/downloads/queue-downloads.component';
import { DownloadedLibraryComponent } from './pages/downloads/downloaded-library.component';
import { DownloadedSeriesDetailComponent } from './pages/downloads/downloaded-series-detail.component';

export const routes: Routes = [
    { path: '', redirectTo: '/browse', pathMatch: 'full' },
    { path: 'browse', component: BrowseComponent },
    { path: 'downloads', redirectTo: '/downloads/queue', pathMatch: 'full' },
    { path: 'downloads/queue', component: QueueDownloadsComponent },
    { path: 'downloads/library/series/:seriesKey', component: DownloadedSeriesDetailComponent },
    { path: 'downloads/library', component: DownloadedLibraryComponent }
];
