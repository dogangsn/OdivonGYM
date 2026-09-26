import { HttpContextToken } from '@angular/common/http';

export const API_SKIP_AUTH = new HttpContextToken<boolean>(() => false);
export const AUTH_RETRY_DONE = new HttpContextToken<boolean>(() => false);
