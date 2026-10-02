import { Injector } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { DocumentDefinitionsService } from './document-definitions.service';
import { DEFAULT_DOCUMENT_DEFINITIONS } from '../models/member-document.model';

describe('DocumentDefinitionsService', () => {
  let authMock: { profile: () => { tenantId: string } | null };
  let service: DocumentDefinitionsService;

  beforeEach(() => {
    localStorage.clear();
    authMock = { profile: () => ({ tenantId: 'test_tenant' }) };

    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: DocumentDefinitionsService },
      ],
    });

    service = injector.get(DocumentDefinitionsService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads default document definitions initially', () => {
    const list = service.definitions();
    expect(list.length).toBeGreaterThanOrEqual(DEFAULT_DOCUMENT_DEFINITIONS.length);
    const healthReport = service.getDefinition('health_report');
    expect(healthReport).toBeDefined();
    expect(healthReport?.name).toContain('Sağlık Raporu');
  });

  it('adds a new custom document definition and persists it', () => {
    const newDef = service.addDefinition({
      name: 'Yüzme Bone & Hijyen Taahhütnamesi',
      documentType: 'other',
      description: 'Havuz kullanım kuralları taahhüdü',
      requiresExpiry: false,
      isRequiredByDefault: false,
    });

    expect(newDef.id).toBeDefined();
    expect(newDef.code).toBeDefined();

    const found = service.getDefinition(newDef.code);
    expect(found).toBeDefined();
    expect(found?.name).toBe('Yüzme Bone & Hijyen Taahhütnamesi');

    const label = service.getLabel(newDef.code);
    expect(label).toBe('Yüzme Bone & Hijyen Taahhütnamesi');
  });

  it('filters active definitions properly', () => {
    const initialActiveCount = service.activeDefinitions().length;
    const def = service.addDefinition({
      name: 'Geçici Test Evrakı',
      documentType: 'waiver_form',
      requiresExpiry: false,
    });

    expect(service.activeDefinitions().length).toBe(initialActiveCount + 1);

    // Deactivate it
    service.updateDefinition(def.id, { isActive: false });
    expect(service.activeDefinitions().length).toBe(initialActiveCount);
  });

  it('deletes custom definitions but prevents deleting system defaults', () => {
    const custom = service.addDefinition({
      name: 'Silinecek Özel Belge',
      documentType: 'other',
    });

    expect(service.getDefinition(custom.code)).toBeDefined();
    const deleted = service.deleteDefinition(custom.id);
    expect(deleted).toBeTrue();
    expect(service.getDefinition(custom.code)).toBeUndefined();

    // Attempt deleting system default
    const deletedDefault = service.deleteDefinition('health_report');
    expect(deletedDefault).toBeFalse();
    expect(service.getDefinition('health_report')).toBeDefined();
  });
});
