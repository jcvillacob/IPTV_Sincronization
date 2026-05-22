import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'safePoster',
  standalone: true
})
export class PosterUrlPipe implements PipeTransform {
  transform(value?: string | null): string {
    const raw = (value || '').trim();
    if (!raw) return '';

    if (raw.startsWith('/api/content/image?url=')) {
      return raw;
    }

    if (/^https?:\/\//i.test(raw)) {
      return `/api/content/image?url=${encodeURIComponent(raw)}`;
    }

    return raw;
  }
}
