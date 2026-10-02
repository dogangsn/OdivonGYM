import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DocumentDefinition,
  DEFAULT_DOCUMENT_DEFINITIONS,
  DocumentType,
} from '../models/member-document.model';
import { AuthService } from '../auth/auth.service';

const STORAGE_KEY_PREFIX = 'odivon_doc_definitions_';

@Injectable({ providedIn: 'root' })
export class DocumentDefinitionsService {
  private readonly auth = inject(AuthService);

  private get storageKey(): string {
    const tenantId = this.auth.profile()?.tenantId || 'default';
    return `${STORAGE_KEY_PREFIX}${tenantId}`;
  }

  private readonly _definitions = signal<DocumentDefinition[]>(this.loadFromStorage());

  readonly definitions = this._definitions.asReadonly();

  readonly activeDefinitions = computed(() => {
    return this._definitions().filter((d) => d.isActive !== false);
  });

  private loadFromStorage(): DocumentDefinition[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed: DocumentDefinition[] = JSON.parse(stored);
        // Ensure all system defaults are present even if new ones were added in code
        const customOrStoredCodes = new Set(parsed.map((d) => d.code));
        const missingDefaults = DEFAULT_DOCUMENT_DEFINITIONS.filter(
          (d) => !customOrStoredCodes.has(d.code),
        );
        return [...parsed, ...missingDefaults];
      }
    } catch {
      // ignore JSON error and fall back to default
    }
    return [...DEFAULT_DOCUMENT_DEFINITIONS];
  }

  private saveToStorage(list: DocumentDefinition[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(list));
    } catch {
      // ignore localStorage quota error
    }
  }

  addDefinition(input: {
    code?: string;
    name: string;
    description?: string;
    documentType: DocumentType;
    requiresExpiry?: boolean;
    isRequiredByDefault?: boolean;
  }): DocumentDefinition {
    const code =
      input.code?.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
      'doc_' + Date.now().toString(36);

    const newDef: DocumentDefinition = {
      id: 'def_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      code,
      name: input.name.trim(),
      description: input.description?.trim() || '',
      documentType: input.documentType,
      requiresExpiry: !!input.requiresExpiry,
      isRequiredByDefault: !!input.isRequiredByDefault,
      isSystemDefault: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const next = [...this._definitions(), newDef];
    this._definitions.set(next);
    this.saveToStorage(next);
    return newDef;
  }

  updateDefinition(id: string, patch: Partial<DocumentDefinition>): void {
    const next = this._definitions().map((d) => (d.id === id ? { ...d, ...patch } : d));
    this._definitions.set(next);
    this.saveToStorage(next);
  }

  deleteDefinition(id: string): boolean {
    const target = this._definitions().find((d) => d.id === id || d.code === id);
    if (!target) return false;

    if (target.isSystemDefault) {
      // Just deactivate system defaults instead of removing completely
      this.updateDefinition(target.id, { isActive: false });
      return false;
    } else {
      const next = this._definitions().filter((d) => d.id !== target.id);
      this._definitions.set(next);
      this.saveToStorage(next);
      return true;
    }
  }

  getDefinition(codeOrId?: string | null): DocumentDefinition | undefined {
    if (!codeOrId) return undefined;
    return this._definitions().find((d) => d.code === codeOrId || d.id === codeOrId);
  }

  getLabel(codeOrId?: string | null): string {
    if (!codeOrId) return '—';
    const def = this.getDefinition(codeOrId);
    return def ? def.name : codeOrId;
  }
}
