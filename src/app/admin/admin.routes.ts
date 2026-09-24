import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'overview',
    loadComponent: () => import('./overview/admin-overview').then((m) => m.AdminOverview),
    title: 'Salon Durumu · OdivonGYM',
  },
  {
    path: 'wizard',
    loadComponent: () => import('./wizard/admin-wizard').then((m) => m.AdminWizard),
    title: 'Eğitim & Tanımlama Sihirbazı · OdivonGYM',
  },
  {
    path: 'members',
    loadComponent: () => import('./members/admin-members').then((m) => m.AdminMembers),
    title: 'Üye Kayıtları · OdivonGYM',
  },
  {
    path: 'subscriptions',
    loadComponent: () =>
      import('./subscriptions/admin-subscriptions').then((m) => m.AdminSubscriptions),
    title: 'Abonelik İşlemleri · OdivonGYM',
  },
  {
    path: 'guest-members',
    loadComponent: () => import('./guest-members/admin-guest-members').then((m) => m.AdminGuestMembers),
    title: 'Misafir Üyeler · OdivonGYM',
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
    path: 'campaigns',
    loadComponent: () => import('./campaigns/admin-campaigns').then((m) => m.AdminCampaigns),
    title: 'Kampanyalar & CRM · OdivonGYM',
  },
  {
    path: 'disciplines',
    loadComponent: () => import('./disciplines/admin-disciplines').then((m) => m.AdminDisciplines),
    title: 'Branşlar & Donanım · OdivonGYM',
  },
  {
    path: 'definitions',
    loadComponent: () => import('./disciplines/admin-disciplines').then((m) => m.AdminDisciplines),
    title: 'Tanımlar & Branşlar · OdivonGYM',
  },
  {
    path: 'stock-categories',
    loadComponent: () => import('./disciplines/admin-disciplines').then((m) => m.AdminDisciplines),
    title: 'Stok & Ürün Kategorileri · OdivonGYM',
  },
  {
    path: 'sales',
    loadComponent: () => import('./sales/admin-sales').then((m) => m.AdminSales),
    title: 'Paket & Market Satışı · OdivonGYM',
  },
  {
    path: 'pos',
    loadComponent: () => import('./pos/admin-pos').then((m) => m.AdminPos),
    title: 'Hızlı Kasa & POS · OdivonGYM',
  },
  {
    path: 'products',
    loadComponent: () => import('./products/admin-products').then((m) => m.AdminProducts),
    title: 'Ürün & Stok Yönetimi · OdivonGYM',
  },
  {
    path: 'reports',
    loadComponent: () => import('./reports/admin-reports').then((m) => m.AdminReports),
    title: 'Satış & Kasa Raporları · OdivonGYM',
  },
  {
    path: 'shop',
    redirectTo: 'sales',
    pathMatch: 'full',
  },
  {
    path: 'accounting',
    loadComponent: () => import('./accounting/admin-accounting').then((m) => m.AdminAccounting),
    title: 'Muhasebe · OdivonGYM',
  },
  {
    path: 'suppliers',
    loadComponent: () => import('./suppliers/admin-suppliers').then((m) => m.AdminSuppliers),
    title: 'Tedarikçi Yönetimi · OdivonGYM',
  },
  {
    path: 'e-invoice',
    loadComponent: () => import('./e-invoice/admin-e-invoice').then((m) => m.AdminEInvoice),
    title: 'E-Fatura & Uyumsoft · OdivonGYM',
  },
  {
    path: 'access-control',
    loadComponent: () =>
      import('./access-control/admin-access-control').then((m) => m.AdminAccessControl),
    title: 'Turnike Sistemi · OdivonGYM',
  },
  {
    path: 'staff',
    loadComponent: () => import('./staff/admin-staff').then((m) => m.AdminStaff),
    title: 'Personel & Rol Yönetimi · OdivonGYM',
  },
  {
    path: 'gym-info',
    loadComponent: () => import('./gym-info/admin-gym-info').then((m) => m.AdminGymInfo),
    title: 'Salon Bilgileri · OdivonGYM',
  },
  {
    path: 'subscription',
    loadComponent: () =>
      import('./subscription/admin-subscription').then((m) => m.AdminSubscription),
    title: 'Paket & Lisans · OdivonGYM',
  },
];
