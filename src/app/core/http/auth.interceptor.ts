import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { toAppError } from '../../shared/models/app-error.model';
import { ErrorCode } from '../../shared/models/error-code.model';
import { AuthService } from '../auth/auth.service';
import { API_SKIP_AUTH, AUTH_RETRY_DONE } from './http-context';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (req.context.get(API_SKIP_AUTH)) {
    return next(req);
  }

  return from(auth.getIdToken()).pipe(
    switchMap((token) => {
      const authorized = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
      return next(authorized).pipe(
        catchError((error: unknown) => {
          if (req.context.get(AUTH_RETRY_DONE)) {
            return throwError(() => error);
          }
          const appError = toAppError(error instanceof HttpErrorResponse ? error : error);
          if (appError.status !== 401 || appError.code !== ErrorCode.INVALID_TOKEN) {
            return throwError(() => error);
          }
          return from(auth.getIdToken(true)).pipe(
            switchMap((freshToken) => {
              if (!freshToken) {
                void auth.logOut();
                return throwError(() => appError);
              }
              const retry = authorized.clone({
                setHeaders: { Authorization: `Bearer ${freshToken}` },
                context: authorized.context.set(AUTH_RETRY_DONE, true),
              });
              return next(retry);
            }),
          );
        }),
      );
    }),
  );
};
