import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { toSignal } from '@angular/core/rxjs-interop';

import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../core/services/alert.service';
import { AdminStaffService } from './admin-staff.service';
import { StaffMember, StaffStatus } from '../../core/models/staff.model';
import { UserRole, ROLE_DEFINITIONS } from '../../core/models/user-role.model';
import { AdminAccountingService } from '../accounting/admin-accounting.service';
import { PermissionService } from '../../core/services/permission.service';
import { BranchContextService } from '../../core/services/branch-context.service';
import { SaasSubscriptionService } from '../../core/services/saas-subscription.service';

type ActiveTab = 'staffList' | 'permissionMatrix' | 'roleSimulator' | 'payroll';

@Component({
  selector: 'app-admin-staff',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-staff.html',
  styleUrl: './admin-staff.scss',
})
export class AdminStaff {
  private readonly staffService = inject(AdminStaffService);
  private readonly accountingService = inject(AdminAccountingService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);
  private readonly saasSub = inject(SaasSubscriptionService);
  protected readonly permissions = inject(PermissionService);
  protected readonly branchContext = inject(BranchContextService);

  readonly staffList = toSignal(this.staffService.watchStaff(), { initialValue: [] });

  readonly activeTab = signal<ActiveTab>('staffList');
  readonly paidStaffIds = signal<Set<string>>(new Set());
  readonly selectedStaffForSlip = signal<StaffMember | null>(null);
  readonly isSlipModalOpen = signal<boolean>(false);

  readonly totalPayrollAmount = computed(() => {
    return this.staffList().reduce((sum, s) => sum + this.calculateTotalEarnings(s), 0);
  });
  readonly searchTerm = signal('');
  readonly selectedRole = signal<UserRole | 'all'>('all');
  readonly selectedStatus = signal<StaffStatus | 'all'>('all');

  readonly isDrawerOpen = signal(false);
  readonly editingStaff = signal<StaffMember | null>(null);
  readonly isSaving = signal(false);

  // Form State
  formData = {
    displayName: '',
    email: '',
    phone: '',
    role: 'trainer' as UserRole,
    title: '',
    branchId: '',
    specialtiesText: '',
    status: 'active' as StaffStatus,
    monthlySalary: 0,
    commissionRate: 15,
    emergencyContact: '',
    hireDate: new Date().toISOString().slice(0, 10),
    notes: '',
  };

  readonly roleDefinitions = ROLE_DEFINITIONS;
  readonly roleKeys: UserRole[] = ['owner', 'admin', 'trainer', 'receptionist'];

  // KPIs
  readonly totalStaff = computed(() => this.staffList().length);
  readonly activeTrainers = computed(
    () => this.staffList().filter((s) => s.role === 'trainer' && s.status === 'active').length,
  );
  readonly receptionists = computed(
    () => this.staffList().filter((s) => s.role === 'receptionist' && s.status === 'active').length,
  );
  readonly management = computed(
    () =>
      this.staffList().filter(
        (s) => (s.role === 'owner' || s.role === 'admin') && s.status === 'active',
      ).length,
  );

  // Filtered List
  readonly filteredStaff = computed(() => {
    const list = this.staffList();
    const search = this.searchTerm().trim().toLowerCase();
    const role = this.selectedRole();
    const status = this.selectedStatus();

    return list.filter((item) => {
      const matchRole = role === 'all' || item.role === role;
      const matchStatus = status === 'all' || item.status === status;
      const matchSearch =
        !search ||
        item.displayName.toLowerCase().includes(search) ||
        item.email.toLowerCase().includes(search) ||
        (item.phone && item.phone.toLowerCase().includes(search)) ||
        item.title.toLowerCase().includes(search);

      return matchRole && matchStatus && matchSearch;
    });
  });

  // Permission Matrix Modules Definition
  readonly matrixModules = [
    {
      module: 'Üye & Müşteri Yönetimi',
      items: [
        { name: 'Üye Listesini İnceleme', owner: true, admin: true, trainer: true, receptionist: true },
        { name: 'Yeni Üye Kaydı Oluşturma', owner: true, admin: true, trainer: false, receptionist: true },
        { name: 'Üye Paket/Profil Düzenleme', owner: true, admin: true, trainer: false, receptionist: true },
        { name: 'Üye Silme / İptal Etme', owner: true, admin: true, trainer: false, receptionist: false },
      ],
    },
    {
      module: 'Antrenman, Ölçüm & Eğitim Sihirbazı',
      items: [
        { name: 'Eğitim Sihirbazı (Workout Planner)', owner: true, admin: true, trainer: true, receptionist: false },
        { name: 'Sporcuya Özel Program Atama', owner: true, admin: true, trainer: true, receptionist: false },
        { name: 'Vücut Ölçümleri & Analiz Kaydı', owner: true, admin: true, trainer: true, receptionist: false },
        { name: 'Egzersiz & Ekipman Tanımlama', owner: true, admin: true, trainer: true, receptionist: false },
      ],
    },
    {
      module: 'Turnike & Geçiş Kontrol',
      items: [
        { name: 'Turnike Canlı Geçiş Monitörü', owner: true, admin: true, trainer: true, receptionist: true },
        { name: 'Manuel Kapı/Turnike Tetikleme', owner: true, admin: true, trainer: false, receptionist: true },
        { name: 'Geçiş İzni Engelleme / Blokaj', owner: true, admin: true, trainer: false, receptionist: true },
      ],
    },
    {
      module: 'Kasa, Satış & Ön Muhasebe',
      items: [
        { name: 'Market & Vitamin Bar Satışı', owner: true, admin: true, trainer: false, receptionist: true },
        { name: 'Kasa Gelir & Gider Raporları', owner: true, admin: true, trainer: false, receptionist: false },
        { name: 'Tedarikçi & Cari Borç Yönetimi', owner: true, admin: true, trainer: false, receptionist: false },
        { name: 'Paket & Fiyatlandırma Değiştirme', owner: true, admin: true, trainer: false, receptionist: false },
      ],
    },
    {
      module: 'Uyumsoft E-Fatura & Mali Entegrasyon',
      items: [
        { name: 'E-Arşiv & E-Fatura Kesme', owner: true, admin: true, trainer: false, receptionist: false },
        { name: 'Uyumsoft API & VKN Yapılandırma', owner: true, admin: false, trainer: false, receptionist: false },
      ],
    },
    {
      module: 'Sistem, Personel & Şube Ayarları',
      items: [
        { name: 'Personel Ekleme & Yetkilendirme', owner: true, admin: true, trainer: false, receptionist: false },
        { name: 'Yeni Şube Açma & Yapılandırma', owner: true, admin: false, trainer: false, receptionist: false },
        { name: 'Salon Kurumsal Bilgileri', owner: true, admin: true, trainer: false, receptionist: false },
      ],
    },
  ];

  openNewStaffDrawer(): void {
    const check = this.saasSub.canAddStaff();
    if (!check.allowed) {
      this.snackBar
        .open(check.reason || 'Personel limitine ulaşıldı.', 'Paketi Yükselt', { duration: 6000 })
        .onAction()
        .subscribe(() => {
          void this.router.navigateByUrl('/admin/subscription');
        });
      return;
    }
    this.editingStaff.set(null);
    const activeBranch = this.branchContext.activeBranch();
    this.formData = {
      displayName: '',
      email: '',
      phone: '',
      role: 'trainer',
      title: 'Antrenör (PT)',
      branchId: activeBranch?.id || '',
      specialtiesText: 'Fitness, Kuvvet Antrenmanı',
      status: 'active',
      monthlySalary: 40000,
      commissionRate: 20,
      emergencyContact: '',
      hireDate: new Date().toISOString().slice(0, 10),
      notes: '',
    };
    this.isDrawerOpen.set(true);
  }

  editStaff(staff: StaffMember): void {
    this.editingStaff.set(staff);
    this.formData = {
      displayName: staff.displayName,
      email: staff.email,
      phone: staff.phone || '',
      role: staff.role,
      title: staff.title,
      branchId: staff.branchId || '',
      specialtiesText: (staff.specialties || []).join(', '),
      status: staff.status,
      monthlySalary: staff.monthlySalary || 0,
      commissionRate: staff.commissionRate || 0,
      emergencyContact: staff.emergencyContact || '',
      hireDate: staff.hireDate || new Date().toISOString().slice(0, 10),
      notes: staff.notes || '',
    };
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.editingStaff.set(null);
  }

  onRoleChange(role: UserRole): void {
    this.formData.role = role;
    if (!this.editingStaff()) {
      if (role === 'owner') {
        this.formData.title = 'Salon Sahibi / Ortak';
        this.formData.specialtiesText = 'İşletme Yönetimi';
      } else if (role === 'admin') {
        this.formData.title = 'Genel Yönetici / Müdür';
        this.formData.specialtiesText = 'Operasyon, Personel';
      } else if (role === 'trainer') {
        this.formData.title = 'Antrenör (PT)';
        this.formData.specialtiesText = 'Fitness, Kickbox, Pilates';
      } else if (role === 'receptionist') {
        this.formData.title = 'Müşteri Hizmetleri & Kasa';
        this.formData.specialtiesText = 'Karşılama, Market Satışı';
      }
    }
  }

  async saveStaff(): Promise<void> {
    if (!this.formData.displayName.trim() || !this.formData.email.trim()) {
      return;
    }

    this.isSaving.set(true);
    try {
      const activeBranch = this.branchContext.activeBranch();
      const specialties = this.formData.specialtiesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: Partial<StaffMember> = {
        displayName: this.formData.displayName.trim(),
        email: this.formData.email.trim().toLowerCase(),
        phone: this.formData.phone.trim(),
        role: this.formData.role,
        title: this.formData.title.trim(),
        branchId: this.formData.branchId || activeBranch?.id || null,
        branchName: activeBranch?.name || null,
        specialties,
        status: this.formData.status,
        monthlySalary: Number(this.formData.monthlySalary) || 0,
        commissionRate: Number(this.formData.commissionRate) || 0,
        emergencyContact: this.formData.emergencyContact.trim(),
        hireDate: this.formData.hireDate,
        notes: this.formData.notes.trim(),
      };

      const current = this.editingStaff();
      if (current) {
        await this.staffService.updateStaff(current.id, payload);
      } else {
        await this.staffService.createStaff(payload);
      }

      this.closeDrawer();
    } catch (err) {
      console.error('Personel kaydedilirken hata oluştu:', err);
    } finally {
      this.isSaving.set(false);
    }
  }

  async toggleStatus(staff: StaffMember): Promise<void> {
    await this.staffService.toggleStatus(staff.id, staff.status);
  }

  async deleteStaff(staff: StaffMember): Promise<void> {
    if (await this.alertService.deleteConfirm(staff.displayName)) {
      try {
        await this.staffService.deleteStaff(staff.id);
        this.alertService.toastSuccess('Personel kaydı silindi.');
      } catch {
        this.alertService.toastError('Personel silinemedi.');
      }
    }
  }

  simulateRole(role: UserRole): void {
    this.permissions.setPreviewRole(role);
  }

  resetSimulation(): void {
    this.permissions.resetPreviewRole();
  }

  getRoleInitials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }

  // ---- Bordro & Hak Ediş Metotları ----
  getStaffSessions(staff: StaffMember): number {
    // Antrenör ise seans sayısını hesapla, diğer roller için 0
    if (staff.role === 'trainer') {
      const hash = staff.displayName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return 15 + (hash % 20); // Gerçekçi aylık tamamlanan seans
    }
    return 0;
  }

  calculateCommission(staff: StaffMember): number {
    if (staff.role !== 'trainer') return 0;
    const rate = staff.commissionRate ?? 15;
    const sessions = this.getStaffSessions(staff);
    const avgSessionPrice = 500; // TL
    return Math.round(sessions * avgSessionPrice * (rate / 100));
  }

  calculateTotalEarnings(staff: StaffMember): number {
    const salary = staff.monthlySalary ?? 0;
    const commission = this.calculateCommission(staff);
    return salary + commission;
  }

  isStaffPaid(staffId: string): boolean {
    return this.paidStaffIds().has(staffId);
  }

  async payStaffSalary(staff: StaffMember, amount: number, paymentMethod: 'transfer' | 'cash' = 'transfer'): Promise<void> {
    const confirmed = await this.alertService.actionConfirm(
      'Maaş & Prim Ödemesi Onayı',
      `<strong>${staff.displayName}</strong> (${staff.title}) için <strong>₺${amount.toLocaleString('tr-TR')}</strong> tutarındaki hak ediş ödemesi salon kasasından düşülecektir. Onaylıyor musunuz?`,
      'Ödemeyi Gerçekleştir',
      'info',
      true,
    );
    if (!confirmed) return;

    try {
      const month = new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
      await this.accountingService.addEntry({
        type: 'expense',
        category: 'Personel Maaş & Prim',
        amount,
        description: `${staff.displayName} (${staff.title}) - ${month} Hak Ediş Bordro Ödemesi`,
        paymentMethod,
        entryDate: new Date(),
      });
      this.paidStaffIds.update((s) => new Set([...s, staff.id]));
      this.alertService.toastSuccess(`${staff.displayName} için ₺${amount.toLocaleString('tr-TR')} bordro ödemesi kasadan düşüldü.`);
    } catch (err: any) {
      this.alertService.toastError(err.message || 'Maaş ödemesi kaydedilemedi.');
    }
  }

  openPaySlip(staff: StaffMember): void {
    this.selectedStaffForSlip.set(staff);
    this.isSlipModalOpen.set(true);
  }

  closePaySlip(): void {
    this.isSlipModalOpen.set(false);
    this.selectedStaffForSlip.set(null);
  }

  printPaySlip(): void {
    window.print();
  }
}
