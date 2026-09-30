import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../../shared/models/envelope.model';
import { API_SKIP_AUTH, SKIP_LOADING } from './http-context';

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined | Record<string, string>
>;

export interface RequestOptions {
  skipAuth?: boolean;
  skipLoading?: boolean;
  query?: QueryParams;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  get<T>(path: string, query?: QueryParams, options?: RequestOptions): Observable<ApiSuccess<T>> {
    return this.http
      .get<ApiSuccess<T>>(this.url(path), this.options(query, options))
      .pipe(map((response) => response));
  }

  post<T>(
    path: string,
    body: unknown,
    options?: RequestOptions,
  ): Observable<ApiSuccess<T>> {
    return this.http.post<ApiSuccess<T>>(this.url(path), body, this.options(options?.query, options));
  }

  patch<T>(path: string, body: unknown, query?: QueryParams, options?: RequestOptions): Observable<ApiSuccess<T>> {
    return this.http.patch<ApiSuccess<T>>(this.url(path), body, this.options(query, options));
  }

  delete<T>(path: string, query?: QueryParams, options?: RequestOptions): Observable<ApiSuccess<T>> {
    return this.http.delete<ApiSuccess<T>>(this.url(path), this.options(query, options));
  }

  private url(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalized}`;
  }

  private options(query?: QueryParams, extra?: RequestOptions) {
    let context: HttpContext | undefined;
    if (extra?.skipAuth) {
      context = (context ?? new HttpContext()).set(API_SKIP_AUTH, true);
    }
    if (extra?.skipLoading) {
      context = (context ?? new HttpContext()).set(SKIP_LOADING, true);
    }
    return {
      params: toHttpParams(query),
      context,
    };
  }
}

export function toHttpParams(query?: QueryParams): HttpParams {
  let params = new HttpParams();
  if (!query) {
    return params;
  }
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (typeof value === 'object') {
      const serialized = JSON.stringify(value);
      if (serialized !== '{}' && serialized !== '[]') {
        params = params.set(key, serialized);
      }
      continue;
    }
    params = params.set(key, String(value));
  }
  return params;
}
