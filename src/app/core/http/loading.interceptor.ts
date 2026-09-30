import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { HttpLoadingService } from '../services/http-loading.service';
import { SKIP_LOADING } from './http-context';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  // Transloco dil dosyalarını çekerken veya arka plan isteklerinde tam ekran bloklayıcı istemeyebiliriz
  if (req.context.get(SKIP_LOADING) || req.url.includes('/assets/i18n/')) {
    return next(req);
  }

  const loadingService = inject(HttpLoadingService);
  loadingService.onRequestStarted();

  return next(req).pipe(
    finalize(() => {
      loadingService.onRequestFinished();
    }),
  );
};
