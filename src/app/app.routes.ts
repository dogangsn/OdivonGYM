import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';
import { trialGuard } from './core/auth/trial.guard';
import { Shell } from './shared/layout/shell/shell';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },

  {
    path: 'onboarding/trial-expired',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/onboarding/trial-expired/trial-expired').then((m) => m.TrialExpired),
    title: 'Paket Satın Al · OdivonGYM',
  },

  {
    path: '',
    component: Shell,
    canActivate: [authGuard, trialGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Ana Sayfa · OdivonGYM',
      },
      {
        path: 'workout',
        loadComponent: () =>
          import('./features/workout/workout-plan/workout-plan').then((m) => m.WorkoutPlan),
        title: 'Antrenman Programı · OdivonGYM',
      },
      {
        path: 'classes',
        loadComponent: () =>
          import('./features/classes/class-schedule/class-schedule').then((m) => m.ClassSchedule),
        title: 'Ders Takvimi · OdivonGYM',
      },
      {
        path: 'appointments',
        loadComponent: () =>
          import('./features/appointments/pt-appointments/pt-appointments').then(
            (m) => m.PtAppointments,
          ),
        title: 'PT Randevu · OdivonGYM',
      },
      {
        path: 'water',
        loadComponent: () =>
          import('./features/water/water-tracker/water-tracker').then((m) => m.WaterTracker),
        title: 'Su Takibi · OdivonGYM',
      },
      {
        path: 'measurements',
        loadComponent: () =>
          import('./features/measurements/body-measurements/body-measurements').then(
            (m) => m.BodyMeasurements,
          ),
        title: 'Vücut Ölçümleri · OdivonGYM',
      },
      {
        path: 'wallet',
        loadComponent: () => import('./features/wallet/wallet/wallet').then((m) => m.Wallet),
        title: 'E-Cüzdan · OdivonGYM',
      },
      {
        path: 'packages',
        loadComponent: () => import('./features/packages/packages/packages').then((m) => m.Packages),
        title: 'Paketler · OdivonGYM',
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile/profile').then((m) => m.Profile),
        title: 'Profil · OdivonGYM',
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadChildren: () => import('./admin/admin.routes').then((m) => m.adminRoutes),
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' },
];
