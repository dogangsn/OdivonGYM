import { Injector } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BodyMeasurement } from '../../../core/models/body-measurement.model';
import { UserProfile } from '../../../core/models/user-profile.model';
import { WaterLog } from '../../../core/models/water-log.model';
import { AlertService } from '../../../core/services/alert.service';
import { AdminMembersService } from '../admin-members.service';
import { MemberBodyState } from './member-body.state';

describe('MemberBodyState', () => {
  let state: MemberBodyState;
  let members: jasmine.SpyObj<AdminMembersService>;

  const at = (date: Date) => ({ toMillis: () => date.getTime() }) as never;

  beforeEach(() => {
    members = jasmine.createSpyObj<AdminMembersService>('AdminMembersService', ['addWaterLog', 'addBodyMeasurement']);
    members.addWaterLog.and.resolveTo(undefined as never);
    members.addBodyMeasurement.and.resolveTo(undefined as never);
    const injector = Injector.create({
      providers: [
        MemberBodyState,
        { provide: FormBuilder, useValue: new FormBuilder() },
        { provide: AdminMembersService, useValue: members },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
        { provide: AlertService, useValue: {} },
      ],
    });
    state = injector.get(MemberBodyState);
    state.bind(() => ({ uid: 'm1' }) as UserProfile);
  });

  it('derives weight change, height and BMI from the latest measurements', () => {
    state.measurements.set([
      { id: 'b', weight: 80, height: null, date: at(new Date()) },
      { id: 'a', weight: 81.5, height: 180, date: at(new Date(Date.now() - 86_400_000)) },
    ] as unknown as BodyMeasurement[]);
    expect(state.weightDelta()).toBe(-1.5);
    expect(state.currentHeight()).toBe(180);
    expect(state.bmiInfo()).toEqual(jasmine.objectContaining({ val: 24.7, label: 'İdeal / Normal' }));
  });

  it('counts only today in the water total and caps the progress at 100%', () => {
    state.waterLogs.set([
      { id: '1', amount: 2500, date: at(new Date()) },
      { id: '2', amount: 1000, date: at(new Date()) },
      { id: '3', amount: 900, date: at(new Date(Date.now() - 2 * 86_400_000)) },
    ] as unknown as WaterLog[]);
    expect(state.todayWaterTotal()).toBe(3500);
    expect(state.waterProgressPercent()).toBe(100);
  });

  it('prefills the measurement form and writes for the bound member including separate arm and leg measurements', async () => {
    state.measurements.set([{ id: 'a', weight: 70, height: 170, date: at(new Date()) }] as unknown as BodyMeasurement[]);
    state.toggleAddMeasurement();
    expect(state.showAddMeasurementForm()).toBeTrue();
    expect(state.measurementForm.value).toEqual(jasmine.objectContaining({ weight: 70, height: 170 }));
    state.measurementForm.patchValue({
      rightBicep: 38.5,
      leftBicep: 38.0,
      rightThigh: 57.0,
      leftThigh: 56.5,
    });
    await state.saveMeasurement();
    expect(members.addBodyMeasurement).toHaveBeenCalledWith(
      'm1',
      jasmine.objectContaining({
        weight: 70,
        height: 170,
        rightBicep: 38.5,
        leftBicep: 38.0,
        rightThigh: 57.0,
        leftThigh: 56.5,
      }),
    );
    expect(state.showAddMeasurementForm()).toBeFalse();

    state.customWaterAmount.set(400);
    state.customWaterNote.set('antrenman sonrası');
    await state.addCustomWater();
    expect(members.addWaterLog).toHaveBeenCalledWith('m1', jasmine.objectContaining({ amount: 400, notes: 'antrenman sonrası' }));
    expect(state.customWaterNote()).toBe('');
  });
});
