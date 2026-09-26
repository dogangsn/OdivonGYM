import { HttpInterceptorFn } from '@angular/common/http';

export const requestIdInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has('x-request-id')) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'x-request-id': crypto.randomUUID() } }));
};
