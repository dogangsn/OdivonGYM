import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { AdminMembersService } from './admin-members.service';
import { MembershipStatus, UserProfile } from '../../core/models/user-profile.model';
import { MemberFormDialog } from './member-form-dialog/member-form-dialog';

const STATUS_LABEL: Record<MembershipStatus, string> = {
  trial: 'Deneme',
  active: 'Aktif',
  expired: 'Süresi Bitti',
  cancelled: 'İptal',
};

const STATUS_BADGE_CLASS: Record<MembershipStatus, string> = {
  trial: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40',
  active:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40',
  expired: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/40',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const GENDER_LABEL: Record<string, string> = {
  female: 'Kadın',
  male: 'Erkek',
  unspecified: 'Belirtilmemiş',
};

@Component({
  selector: 'app-admin-members',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatTooltipModule, MemberFormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-members.html',
  styleUrl: './admin-members.scss',
})
export class AdminMembers {
  private readonly membersService = inject(AdminMembersService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusBadgeClass = STATUS_BADGE_CLASS;
  protected readonly genderLabel = GENDER_LABEL;
  protected readonly searchTerm = signal('');

  protected readonly drawerOpen = signal(false);
  protected readonly editingMember = signal<UserProfile | null>(null);

  private readonly members = toSignal(this.membersService.watchMembers(), { initialValue: null });

  protected readonly loading = computed(() => this.members() === null);

  protected readonly filteredMembers = computed<UserProfile[]>(() => {
    const list = this.members() ?? [];
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (m) =>
        m.displayName?.toLowerCase().includes(term) ||
        m.email?.toLowerCase().includes(term) ||
        m.phone?.toLowerCase().includes(term),
    );
  });

  openNewMemberDrawer(): void {
    this.editingMember.set(null);
    this.drawerOpen.set(true);
  }

  openEditDrawer(member: UserProfile): void {
    this.editingMember.set(member);
    this.drawerOpen.set(true);
  }

  onDrawerClosed(saved: boolean): void {
    this.drawerOpen.set(false);
    if (saved) {
      this.snackBar.open(
        this.editingMember() ? 'Üye bilgileri güncellendi.' : 'Üye başarıyla oluşturuldu.',
        'Kapat',
        { duration: 3000 },
      );
    }
    this.editingMember.set(null);
  }

  async changeStatus(member: UserProfile, status: MembershipStatus): Promise<void> {
    if (status === member.membershipStatus) return;
    try {
      await this.membersService.setMembershipStatus(member.uid, status);
      this.snackBar.open(`${member.displayName} → ${this.statusLabel[status]}`, 'Kapat', { duration: 2500 });
    } catch {
      this.snackBar.open('Durum güncellenemedi, tekrar dene.', 'Kapat', { duration: 3000 });
    }
  }

  initials(name: string | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }

  formatDate(ts: UserProfile['createdAt'] | undefined): string {
    if (!ts) return '—';
    return ts.toDate().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
