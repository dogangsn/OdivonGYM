import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { CreateTicketRequest, SupportTicket } from '../models/support-ticket.model';

@Injectable({ providedIn: 'root' })
export class SupportTicketApi {
  private readonly api = inject(ApiClient);

  createTicket(body: CreateTicketRequest) {
    return this.api.post<SupportTicket>('/support/tickets', body).pipe(map((r) => r.data));
  }

  trackTicket(trackingNumber: string) {
    return this.api
      .get<SupportTicket>(`/support/tickets/track/${encodeURIComponent(trackingNumber)}`, {
        skipAuth: true,
      })
      .pipe(map((r) => r.data));
  }

  myTickets(email?: string) {
    const params = email ? { email } : undefined;
    return this.api.get<SupportTicket[]>('/support/tickets/my-tickets', { params }).pipe(map((r) => r.data));
  }
}
