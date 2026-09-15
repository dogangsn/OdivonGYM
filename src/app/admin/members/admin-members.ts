import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { AdminMembersService } from './admin-members.service';
import { MembershipStatus, UserProfile } from '../../core/models/user-profile.model';
import { MemberFormDialog } from './member-form-dialog/member-form-dialog';

const STATUS_LABEL: Record<MembershipStatus, string> = {
  trial: 'Deneme',
  active: 'Aktif',
  expired: 'Süresi Bitti',
  cancelled: 'İptal',
};

const GENDER_LABEL: Record<string, string> = {
  female: 'Kadın',
  male: 'Erkek',
  unspecified: 'Belirtilmemiş',
};

@Component({
  selector: 'app-admin-members',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatButtonModule, MatSelectModule, MatTooltipModule, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-members.html',
  styleUrl: './admin-members.scss',
})
export class AdminMembers {
  private readonly membersService = inject(AdminMembersService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly genderLabel = GENDER_LABEL;
  protected readonly searchTerm = signal('');

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

  openNewMemberDialog(): void {
    const ref = this.dialog.open(MemberFormDialog, { width: '600px', autoFocus: false });
    ref.afterClosed().subscribe((saved: boolean | undefined) => {
      if (saved) {
        this.snackBar.open('Üye başarıyla oluşturuldu.', 'Kapat', { duration: 3000 });
      }
    });
  }

  openEditDialog(member: UserProfile): void {
    const ref = this.dialog.open(MemberFormDialog, {
      width: '600px',
      autoFocus: false,
      data: { member },
    });
    ref.afterClosed().subscribe((saved: boolean | undefined) => {
      if (saved) {
        this.snackBar.open('Üye bilgileri güncellendi.', 'Kapat', { duration: 3000 });
      }
    });
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
