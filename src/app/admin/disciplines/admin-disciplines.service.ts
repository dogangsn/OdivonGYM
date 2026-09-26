import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { CatalogApi } from '../../core/api/catalog.api';
import { tenantReload } from '../../core/api/unwrap';
import { AuthService } from '../../core/auth/auth.service';
import {
  CreateGymEquipmentInput,
  CreateGymFacilityInput,
  DEFAULT_EQUIPMENT_PRESETS,
  GymEquipment,
  GymFacility,
  UpdateGymEquipmentInput,
  UpdateGymFacilityInput,
} from '../../core/models/gym-equipment.model';
import {
  CreateSportsDisciplineInput,
  DEFAULT_DISCIPLINES_PRESETS,
  SportsDiscipline,
  UpdateSportsDisciplineInput,
} from '../../core/models/sports-discipline.model';

export function normalizeDisciplineKey(str: string): string {
  return (str || '')
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıiİI]/g, 'i')
    .replace(/[ğgĞG]/g, 'g')
    .replace(/[üuÜU]/g, 'u')
    .replace(/[şsŞS]/g, 's')
    .replace(/[öoÖO]/g, 'o')
    .replace(/[çcÇC]/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

@Injectable({ providedIn: 'root' })
export class AdminDisciplinesService {
  private readonly api = inject(CatalogApi);
  private readonly auth = inject(AuthService);
  private readonly profile$ = toObservable(this.auth.profile);
  private readonly reload$ = new Subject<void>();

  watchDisciplines(): Observable<SportsDiscipline[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listDisciplines());
  }

  async createDiscipline(input: CreateSportsDisciplineInput): Promise<string> {
    const created = await firstValueFrom(this.api.createDiscipline(input));
    this.reload$.next();
    return created.id;
  }

  async updateDiscipline(id: string, input: UpdateSportsDisciplineInput): Promise<void> {
    await firstValueFrom(this.api.updateDiscipline(id, input));
    this.reload$.next();
  }

  async deleteDiscipline(id: string): Promise<void> {
    await firstValueFrom(this.api.removeDiscipline(id));
    this.reload$.next();
  }

  async seedDefaultDisciplines(): Promise<{ added: number; skipped: number }> {
    const existing = await firstValueFrom(this.api.listDisciplines());
    const names = new Set(existing.map((d) => normalizeDisciplineKey(d.name)));
    let added = 0;
    for (const preset of DEFAULT_DISCIPLINES_PRESETS) {
      if (names.has(normalizeDisciplineKey(preset.name))) continue;
      await firstValueFrom(this.api.createDiscipline(preset));
      added++;
    }
    this.reload$.next();
    return { added, skipped: DEFAULT_DISCIPLINES_PRESETS.length - added };
  }

  watchFacilities(): Observable<GymFacility[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listFacilities());
  }

  async createFacility(input: CreateGymFacilityInput): Promise<string> {
    const created = await firstValueFrom(this.api.createFacility(input));
    this.reload$.next();
    return created.id;
  }

  async updateFacility(id: string, input: UpdateGymFacilityInput): Promise<void> {
    await firstValueFrom(this.api.updateFacility(id, input));
    this.reload$.next();
  }

  async deleteFacility(id: string): Promise<void> {
    await firstValueFrom(this.api.removeFacility(id));
    this.reload$.next();
  }

  watchEquipment(): Observable<GymEquipment[]> {
    return tenantReload(this.profile$, this.reload$, () => this.api.listEquipment());
  }

  async createEquipment(input: CreateGymEquipmentInput): Promise<string> {
    const created = await firstValueFrom(
      this.api.createEquipment({
        ...input,
        lastMaintenanceDate: input.lastMaintenanceDate
          ? input.lastMaintenanceDate.toISOString()
          : input.lastMaintenanceDate,
      }),
    );
    this.reload$.next();
    return created.id;
  }

  async updateEquipment(id: string, input: UpdateGymEquipmentInput): Promise<void> {
    await firstValueFrom(
      this.api.updateEquipment(id, {
        ...input,
        lastMaintenanceDate:
          input.lastMaintenanceDate instanceof Date
            ? input.lastMaintenanceDate.toISOString()
            : input.lastMaintenanceDate,
      }),
    );
    this.reload$.next();
  }

  async deleteEquipment(id: string): Promise<void> {
    await firstValueFrom(this.api.removeEquipment(id));
    this.reload$.next();
  }

  async seedDefaultEquipment(): Promise<{ added: number; skipped: number }> {
    const existing = await firstValueFrom(this.api.listEquipment());
    const names = new Set(existing.map((d) => normalizeDisciplineKey(d.name)));
    let added = 0;
    for (const preset of DEFAULT_EQUIPMENT_PRESETS) {
      if (names.has(normalizeDisciplineKey(preset.name))) continue;
      await this.createEquipment(preset);
      added++;
    }
    return { added, skipped: DEFAULT_EQUIPMENT_PRESETS.length - added };
  }

  async cleanupDuplicateRecords(): Promise<{ deletedDisciplines: number; deletedEquipment: number }> {
    const [disciplines, equipment] = await Promise.all([
      firstValueFrom(this.api.listDisciplines()),
      firstValueFrom(this.api.listEquipment()),
    ]);
    let deletedDisciplines = 0;
    let deletedEquipment = 0;
    const discSeen = new Set<string>();
    for (const item of [...disciplines].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
      const key = item.code && item.code !== 'other' ? item.code : normalizeDisciplineKey(item.name);
      if (discSeen.has(key)) {
        await this.deleteDiscipline(item.id);
        deletedDisciplines++;
      } else {
        discSeen.add(key);
      }
    }
    const eqSeen = new Set<string>();
    for (const item of [...equipment].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
      const key = normalizeDisciplineKey(item.name);
      if (eqSeen.has(key)) {
        await this.deleteEquipment(item.id);
        deletedEquipment++;
      } else {
        eqSeen.add(key);
      }
    }
    return { deletedDisciplines, deletedEquipment };
  }
}
