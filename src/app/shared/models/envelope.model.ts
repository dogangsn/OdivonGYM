export interface ApiMeta {
  requestId: string;
  limit?: number;
  nextCursor?: string | null;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
  meta: { requestId: string };
}
