import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BUILD_INFO } from '../version/build-info';

/** Tells MainApi which panel build is calling, so it can ask outdated tabs to update (426). */
export const clientVersionInterceptor: HttpInterceptorFn = (req, next) => {
  const api = environment.apiBaseUrl.replace(/\/$/, '');
  if (!req.url.startsWith(api)) return next(req);
  return next(req.clone({ setHeaders: { 'X-Client-Version': `${BUILD_INFO.version}+${BUILD_INFO.commit}` } }));
};
