import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../../shared/models/envelope.model';
import { API_SKIP_AUTH } from './http-context';

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined | Record<string, string>
>;

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  get<T>(path: string, query?: QueryParams, options?: { skipAuth?: boolean }): Observable<ApiSuccess<T>> {
    return this.http
      .get<ApiSuccess<T>>(this.url(path), this.options(query, options))
      .pipe(map((response) => response));
  }

  post<T>(
    path: string,
    body: unknown,
    options?: { skipAuth?: boolean; query?: QueryParams },
  ): Observable<ApiSuccess<T>> {
    return this.http.post<ApiSuccess<T>>(this.url(path), body, this.options(options?.query, options));
  }

  patch<T>(path: string, body: unknown, query?: QueryParams): Observable<ApiSuccess<T>> {
    return this.http.patch<ApiSuccess<T>>(this.url(path), body, this.options(query));
  }

  delete<T>(path: string, query?: QueryParams): Observable<ApiSuccess<T>> {
    return this.http.delete<ApiSuccess<T>>(this.url(path), this.options(query));
  }

  private url(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalized}`;
  }

  private options(query?: QueryParams, extra?: { skipAuth?: boolean }) {
    return {
      params: toHttpParams(query),
      context: extra?.skipAuth ? new HttpContext().set(API_SKIP_AUTH, true) : undefined,
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
