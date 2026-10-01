import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Timestamp } from '@angular/fire/firestore';
import { formatDateTime, toJsDate } from '../../../shared/ui/ui-utils';
import { MemberBodyState } from './member-body.state';

function formatDate(ts?: string | Timestamp | null): string {
  if (!ts) return '—';
  return (
    toJsDate(ts)?.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) ??
    '—'
  );
}

function formatTime(ts?: string | Timestamp | null): string {
  if (!ts) return '—';
  return formatDateTime(ts);
}

const IMPORTS = [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule, MatTooltipModule];

/** Üye detayı → "Kilo & Vücut Ölçümleri" sekmesi. Durum `MemberBodyState`'te (detay penceresi sağlar). */
@Component({
  selector: 'app-member-measurements-tab',
  standalone: true,
  imports: IMPORTS,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './member-measurements-tab.html',
})
export class MemberMeasurementsTab {
  private readonly body = inject(MemberBodyState);

  protected readonly measurements = this.body.measurements;
  protected readonly showAddMeasurementForm = this.body.showAddMeasurementForm;
  protected readonly savingMeasurement = this.body.savingMeasurement;
  protected readonly measurementForm = this.body.measurementForm;
  protected readonly formatDate = formatDate;

  protected toggleAddMeasurement(): void {
    this.body.toggleAddMeasurement();
  }

  protected saveMeasurement(): Promise<void> {
    return this.body.saveMeasurement();
  }

  protected deleteMeasurement(id: string): Promise<void> {
    return this.body.deleteMeasurement(id);
  }
}

/** Üye detayı → "Günlük Su Takibi" sekmesi. Durum `MemberBodyState`'te (detay penceresi sağlar). */
@Component({
  selector: 'app-member-water-tab',
  standalone: true,
  imports: IMPORTS,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './member-water-tab.html',
})
export class MemberWaterTab {
  private readonly body = inject(MemberBodyState);

  protected readonly waterLogs = this.body.waterLogs;
  protected readonly savingWater = this.body.savingWater;
  protected readonly customWaterAmount = this.body.customWaterAmount;
  protected readonly customWaterNote = this.body.customWaterNote;
  protected readonly todayWaterTotal = this.body.todayWaterTotal;
  protected readonly waterTarget = this.body.waterTarget;
  protected readonly waterProgressPercent = this.body.waterProgressPercent;
  protected readonly formatDate = formatDate;
  protected readonly formatTime = formatTime;

  protected addQuickWater(amount: number, note = ''): Promise<void> {
    return this.body.addQuickWater(amount, note);
  }

  protected addCustomWater(): Promise<void> {
    return this.body.addCustomWater();
  }

  protected deleteWaterLog(id: string): Promise<void> {
    return this.body.deleteWaterLog(id);
  }
}
