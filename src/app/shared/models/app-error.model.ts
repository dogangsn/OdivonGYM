import { HttpErrorResponse } from '@angular/common/http';
import { ApiFailure } from './envelope.model';
import { ErrorCode } from './error-code.model';

export class AppError extends Error {
  override readonly name = 'AppError';

  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly requestId?: string,
    readonly details?: Record<string, string>,
  ) {
    super(message);
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiFailure | undefined;
    if (body && body.success === false && body.error) {
      return new AppError(
        body.error.code,
        body.error.message,
        error.status,
        body.meta?.requestId,
        body.error.details,
      );
    }
    return new AppError(
      error.status === 401 ? ErrorCode.AUTH_REQUIRED : ErrorCode.INTERNAL_ERROR,
      error.message || 'İstek başarısız oldu',
      error.status || 0,
    );
  }
  if (error instanceof Error) {
    return new AppError(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }
  return new AppError(ErrorCode.INTERNAL_ERROR, 'Beklenmeyen hata', 500);
}
