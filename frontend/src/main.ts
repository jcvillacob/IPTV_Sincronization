import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { importProvidersFrom } from '@angular/core';
import { LucideAngularModule, Film, Search, Download, HardDrive, Heart, Clock, Tv, Play, Plus, Check, X, RefreshCw, Trash2, Calendar, Loader2, AlertCircle, ChevronDown, Filter, Grid, List, Star, Eye, FolderDown } from 'lucide-angular';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
    providers: [
        provideHttpClient(),
        provideRouter(routes),
        importProvidersFrom(
            LucideAngularModule.pick({
                Film, Search, Download, HardDrive, Heart, Clock, Tv, Play, Plus, Check, X,
                RefreshCw, Trash2, Calendar, Loader2, AlertCircle, ChevronDown, Filter,
                Grid, List, Star, Eye, FolderDown
            })
        )
    ]
}).catch(err => console.error(err));
