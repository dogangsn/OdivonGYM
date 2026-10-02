import { Injectable, signal } from '@angular/core';
import { ConsentText } from '../../../core/models/consent.model';

@Injectable({ providedIn: 'root' })
export class ConsentModalService {
  readonly isOpen = signal(false);
  readonly text = signal<ConsentText | null>(null);

  open(text: ConsentText) {
    this.text.set(text);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.text.set(null);
  }
}
