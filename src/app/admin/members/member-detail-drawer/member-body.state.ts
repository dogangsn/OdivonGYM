import { Injectable, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BodyMeasurement } from '../../../core/models/body-measurement.model';
import { UserProfile } from '../../../core/models/user-profile.model';
import { WaterLog } from '../../../core/models/water-log.model';
import { AlertService } from '../../../core/services/alert.service';
import { toMillis } from '../../../shared/ui/ui-utils';
import { AdminMembersService } from '../admin-members.service';

/**
 * Üye detayındaki ölçüm ve su takibi durumu. Detay penceresi (`MemberDetailDrawer`) sağlar;
 * pencerenin üst kısmındaki özet kartları ile "Ölçümler" ve "Su" sekmeleri aynı örneği kullanır,
 * böylece sekme değişince form ve girişler korunur.
 */
@Injectable()
export class MemberBodyState {
  private readonly membersService = inject(AdminMembersService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);

  private member: () => UserProfile | null = () => null;

  readonly measurements = signal<BodyMeasurement[]>([]);
  readonly waterLogs = signal<WaterLog[]>([]);

  // Form toggles & states
  readonly showAddMeasurementForm = signal(false);
  readonly savingMeasurement = signal(false);
  readonly savingWater = signal(false);
  readonly customWaterAmount = signal<number>(250);
  readonly customWaterNote = signal<string>('');

  readonly measurementForm: FormGroup = this.fb.group({
    date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    weight: [null, [Validators.min(20), Validators.max(300)]],
    height: [null, [Validators.min(50), Validators.max(250)]],
    bodyFatPercentage: [null, [Validators.min(1), Validators.max(70)]],
    chest: [null, [Validators.min(30), Validators.max(200)]],
    waist: [null, [Validators.min(30), Validators.max(200)]],
    hips: [null, [Validators.min(30), Validators.max(200)]],
    bicep: [null, [Validators.min(10), Validators.max(80)]],
    rightBicep: [null, [Validators.min(10), Validators.max(80)]],
    leftBicep: [null, [Validators.min(10), Validators.max(80)]],
    thigh: [null, [Validators.min(20), Validators.max(120)]],
    rightThigh: [null, [Validators.min(20), Validators.max(120)]],
    leftThigh: [null, [Validators.min(20), Validators.max(120)]],
    calf: [null, [Validators.min(15), Validators.max(80)]],
    notes: [''],
  });

  /** Son ölçüm kaydı */
  readonly latestMeasurement = computed(() => {
    const list = this.measurements();
    return list.length > 0 ? list[0] : null;
  });

  /** Bir önceki ölçüm (delta kilo hesabı için) */
  readonly previousMeasurement = computed(() => {
    const list = this.measurements();
    return list.length > 1 ? list[1] : null;
  });

  /** Kilo farkı (örn: -1.2 kg ya da +0.5 kg) */
  readonly weightDelta = computed(() => {
    const curr = this.latestMeasurement()?.weight;
    const prev = this.previousMeasurement()?.weight;
    if (curr === undefined || curr === null || prev === undefined || prev === null) {
      return null;
    }
    const diff = +(curr - prev).toFixed(1);
    return diff;
  });

  /** Son boy bilgisi */
  readonly currentHeight = computed(() => {
    const list = this.measurements();
    for (const m of list) {
      if (m.height) return m.height;
    }
    return null;
  });

  /** Vücut Kitle Endeksi (BMI) */
  readonly bmiInfo = computed(() => {
    const w = this.latestMeasurement()?.weight;
    const h = this.currentHeight();
    if (!w || !h || h <= 0) return null;
    const hM = h / 100;
    const val = +(w / (hM * hM)).toFixed(1);

    if (val < 18.5) {
      return { val, label: 'Zayıf', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (val <= 24.9) {
      return {
        val,
        label: 'İdeal / Normal',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    if (val <= 29.9) {
      return {
        val,
        label: 'Fazla Kilolu',
        badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
      };
    }
    return { val, label: 'Obez', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' };
  });

  /** Bugün içilen toplam su (ml) */
  readonly todayWaterTotal = computed(() => {
    const logs = this.waterLogs();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const tomorrowMs = todayMs + 24 * 60 * 60 * 1000;

    return logs
      .filter((l) => {
        const t = toMillis(l.date);
        return t >= todayMs && t < tomorrowMs;
      })
      .reduce((sum, l) => sum + (l.amount || 0), 0);
  });

  /** Günlük hedef (3000 ml varsayılan) ve yüzde */
  readonly waterTarget = 3000;
  readonly waterProgressPercent = computed(() => {
    const total = this.todayWaterTotal();
    return Math.min(100, Math.round((total / this.waterTarget) * 100));
  });

  /** Kaydın hangi üyeye yazılacağını detay penceresi bağlar. */
  bind(member: () => UserProfile | null): void {
    this.member = member;
  }

  toggleAddMeasurement(): void {
    this.showAddMeasurementForm.update((v) => !v);
    if (this.showAddMeasurementForm()) {
      this.measurementForm.patchValue({
        date: new Date().toISOString().substring(0, 10),
        weight: this.latestMeasurement()?.weight || null,
        height: this.currentHeight() || null,
      });
    }
  }

  async saveMeasurement(): Promise<void> {
    const current = this.member();
    if (!current?.uid) return;
    if (this.measurementForm.invalid) {
      this.measurementForm.markAllAsTouched();
      return;
    }

    const val = this.measurementForm.value;
    const dateVal = val.date ? new Date(val.date) : new Date();

    this.savingMeasurement.set(true);
    try {
      const rightBicepNum = val.rightBicep ? Number(val.rightBicep) : undefined;
      const leftBicepNum = val.leftBicep ? Number(val.leftBicep) : undefined;
      const rightThighNum = val.rightThigh ? Number(val.rightThigh) : undefined;
      const leftThighNum = val.leftThigh ? Number(val.leftThigh) : undefined;
      const bicepNum = val.bicep ? Number(val.bicep) : (rightBicepNum || leftBicepNum);
      const thighNum = val.thigh ? Number(val.thigh) : (rightThighNum || leftThighNum);

      await this.membersService.addBodyMeasurement(current.uid, {
        date: dateVal,
        weight: val.weight ? Number(val.weight) : undefined,
        height: val.height ? Number(val.height) : undefined,
        bodyFatPercentage: val.bodyFatPercentage ? Number(val.bodyFatPercentage) : undefined,
        chest: val.chest ? Number(val.chest) : undefined,
        waist: val.waist ? Number(val.waist) : undefined,
        hips: val.hips ? Number(val.hips) : undefined,
        bicep: bicepNum,
        rightBicep: rightBicepNum,
        leftBicep: leftBicepNum,
        thigh: thighNum,
        rightThigh: rightThighNum,
        leftThigh: leftThighNum,
        calf: val.calf ? Number(val.calf) : undefined,
        notes: val.notes?.trim() || '',
      });

      this.snackBar.open('Vücut ölçümü ve kilo kaydı başarıyla eklendi.', 'Tamam', {
        duration: 3000,
      });
      this.showAddMeasurementForm.set(false);
      this.measurementForm.reset({
        date: new Date().toISOString().substring(0, 10),
      });
    } catch (err) {
      console.error(err);
      this.snackBar.open('Ölçüm kaydedilemedi. Lütfen tekrar deneyin.', 'Kapat', {
        duration: 4000,
      });
    } finally {
      this.savingMeasurement.set(false);
    }
  }

  async deleteMeasurement(id: string): Promise<void> {
    if (!(await this.alertService.deleteConfirm('Ölçüm Kaydı'))) return;
    try {
      await this.membersService.deleteBodyMeasurement(id);
      this.alertService.toastSuccess('Ölçüm kaydı silindi.');
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Silme işlemi başarısız oldu.');
    }
  }

  async addQuickWater(amount: number, note = ''): Promise<void> {
    const current = this.member();
    if (!current?.uid) return;
    this.savingWater.set(true);
    try {
      await this.membersService.addWaterLog(current.uid, {
        date: new Date(),
        amount,
        unit: 'ml',
        notes: note,
      });
      this.snackBar.open(`+${amount} ml su kaydı eklendi!`, 'Tamam', { duration: 2500 });
    } catch (err) {
      console.error(err);
      this.snackBar.open('Su kaydı eklenemedi.', 'Kapat', { duration: 3000 });
    } finally {
      this.savingWater.set(false);
    }
  }

  async addCustomWater(): Promise<void> {
    const amount = Number(this.customWaterAmount());
    if (!amount || amount <= 0) {
      this.snackBar.open('Geçerli bir su miktarı girin.', 'Kapat', { duration: 2500 });
      return;
    }
    await this.addQuickWater(amount, this.customWaterNote() || '');
    this.customWaterNote.set('');
  }

  async deleteWaterLog(id: string): Promise<void> {
    if (!(await this.alertService.deleteConfirm('Su Tüketim Kaydı'))) return;
    try {
      await this.membersService.deleteWaterLog(id);
      this.alertService.toastSuccess('Su kaydı silindi.');
    } catch (err) {
      console.error(err);
      this.alertService.toastError('Silme başarısız.');
    }
  }
}
