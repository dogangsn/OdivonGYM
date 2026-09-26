import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { toAppError } from '../../shared/models/app-error.model';
import { ErrorCode } from '../../shared/models/error-code.model';
import { AuthService } from '../auth/auth.service';
import { API_SKIP_AUTH, AUTH_RETRY_DONE } from './http-context';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const appError = toAppError(error);

      if (appError.code === ErrorCode.FORBIDDEN_PERMISSION) {
        snackBar.open('Bu işlem için yetkiniz yok', 'Kapat', { duration: 5000 });
        return throwError(() => appError);
      }

      if (appError.code === ErrorCode.USER_INACTIVE) {
        snackBar.open('Hesabınız pasif durumda', 'Kapat', { duration: 5000 });
        void auth.logOut();
        return throwError(() => appError);
      }

      const skipAuth = req.context.get(API_SKIP_AUTH);
      const retryDone = req.context.get(AUTH_RETRY_DONE);
      const authFailure =
        appError.code === ErrorCode.AUTH_REQUIRED || appError.code === ErrorCode.INVALID_TOKEN;

      if (!skipAuth && authFailure && retryDone) {
        void auth.logOut();
        return throwError(() => appError);
      }

      if (appError.status >= 500) {
        snackBar.open(appError.message || 'Sunucu hatası', 'Kapat', { duration: 5000 });
      }

      return throwError(() => appError);
    }),
  );
};
