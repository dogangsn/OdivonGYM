import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'overview',
    loadComponent: () => import('./overview/admin-overview').then((m) => m.AdminOverview),
    title: 'Salon Durumu · OdivonGYM',
  },
  {
    path: 'members',
    loadComponent: () => import('./members/admin-members').then((m) => m.AdminMembers),
    title: 'Üye Kayıtları · OdivonGYM',
  },
  {
    path: 'branches',
    loadComponent: () => import('./branches/admin-branches').then((m) => m.AdminBranches),
    title: 'Şubeler · OdivonGYM',
  },
  {
    path: 'packages',
    loadComponent: () => import('./packages/admin-packages').then((m) => m.AdminPackages),
    title: 'Paket & Fiyatlandırma · OdivonGYM',
  },
  {
    path: 'shop',
    loadComponent: () => import('./shop/admin-shop').then((m) => m.AdminShop),
    title: 'Market Satışları · OdivonGYM',
  },
  {
    path: 'accounting',
    loadComponent: () => import('./accounting/admin-accounting').then((m) => m.AdminAccounting),
    title: 'Muhasebe · OdivonGYM',
  },
  {
    path: 'access-control',
    loadComponent: () =>
      import('./access-control/admin-access-control').then((m) => m.AdminAccessControl),
    title: 'Turnike Sistemi · OdivonGYM',
  },
  {
    path: 'gym-info',
    loadComponent: () => import('./gym-info/admin-gym-info').then((m) => m.AdminGymInfo),
    title: 'Salon Bilgileri · OdivonGYM',
  },
];
