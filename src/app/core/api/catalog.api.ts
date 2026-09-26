import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { GymEquipment, GymFacility } from '../models/gym-equipment.model';
import { SportsDiscipline } from '../models/sports-discipline.model';
import { unwrapList } from './unwrap';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly api = inject(ApiClient);

  listDisciplines() {
    return this.api
      .get<SportsDiscipline[]>('/gym/disciplines', { limit: 100 })
      .pipe(map((r) => unwrapList<SportsDiscipline>(r.data)));
  }

  createDiscipline(body: unknown) {
    return this.api.post<SportsDiscipline>('/gym/disciplines', body).pipe(map((r) => r.data));
  }

  updateDiscipline(id: string, body: unknown) {
    return this.api.patch<SportsDiscipline>(`/gym/disciplines/${id}`, body).pipe(map((r) => r.data));
  }

  removeDiscipline(id: string) {
    return this.api.delete<{ id: string }>(`/gym/disciplines/${id}`).pipe(map((r) => r.data));
  }

  listFacilities() {
    return this.api.get<GymFacility[]>('/gym/facilities', { limit: 100 }).pipe(map((r) => unwrapList<GymFacility>(r.data)));
  }

  createFacility(body: unknown) {
    return this.api.post<GymFacility>('/gym/facilities', body).pipe(map((r) => r.data));
  }

  updateFacility(id: string, body: unknown) {
    return this.api.patch<GymFacility>(`/gym/facilities/${id}`, body).pipe(map((r) => r.data));
  }

  removeFacility(id: string) {
    return this.api.delete<{ id: string }>(`/gym/facilities/${id}`).pipe(map((r) => r.data));
  }

  listEquipment() {
    return this.api.get<GymEquipment[]>('/gym/equipment', { limit: 100 }).pipe(map((r) => unwrapList<GymEquipment>(r.data)));
  }

  createEquipment(body: unknown) {
    return this.api.post<GymEquipment>('/gym/equipment', body).pipe(map((r) => r.data));
  }

  updateEquipment(id: string, body: unknown) {
    return this.api.patch<GymEquipment>(`/gym/equipment/${id}`, body).pipe(map((r) => r.data));
  }

  removeEquipment(id: string) {
    return this.api.delete<{ id: string }>(`/gym/equipment/${id}`).pipe(map((r) => r.data));
  }
}
