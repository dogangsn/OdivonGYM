const fs = require('fs');
const path = 'C:/Users/dogan/Documents/Private/Project/OdivonMainApi/src/modules/gym/ops/daily-close/daily-close.service.ts';
let code = fs.readFileSync(path, 'utf8');

// Replace imports
code = code.replace(
  "import { Injectable } from '@nestjs/common';",
  "import { Injectable, Logger } from '@nestjs/common';"
);

code = code.replace(
  "import { TENANT_COLLECTION } from '../../../../shared/firebase/firestore-path';",
  "import { TENANT_COLLECTION, ROOT_COLLECTION, tenantCollectionPath } from '../../../../shared/firebase/firestore-path';\n" +
  "import { FirebaseService } from '../../../../shared/firebase/firebase.service';\n" +
  "import { MailService } from '../../../../shared/mail/mail.service';\n" +
  "import { GymStaff } from '../../staff/staff.entity';\n" +
  "import { TenantNotificationDoc } from '../../../platform/crm/crm-notifications.service';\n" +
  "import { isDeleted } from '../../../../shared/firestore/base-document';"
);

// Update constructor
code = code.replace(
  "export class GymDailyCloseService {\n  constructor(private readonly store: GymStore) {}",
  "export class GymDailyCloseService {\n  private readonly logger = new Logger(GymDailyCloseService.name);\n\n  constructor(\n    private readonly store: GymStore,\n    private readonly firebase: FirebaseService,\n    private readonly mailService: MailService,\n  ) {}"
);

// Replace submitDailyClose return
const oldReturn = `    if (preview.existingClosing?.id) {
      await this.store.update(
        DAILY_CLOSINGS_COLLECTION,
        preview.existingClosing.id,
        ErrorCode.GYM_ACCOUNTING_NOT_FOUND,
        'Closing not found',
        payload as Record<string, unknown>,
      );
      return {
        ...preview.existingClosing,
        ...payload,
      };
    }

    const created = await this.store.create(DAILY_CLOSINGS_COLLECTION, payload as Record<string, unknown>);
    return created as unknown as GymDailyClosing;`;

const newReturn = `    let finalClosing: GymDailyClosing;
    if (preview.existingClosing?.id) {
      await this.store.update(
        DAILY_CLOSINGS_COLLECTION,
        preview.existingClosing.id,
        ErrorCode.GYM_ACCOUNTING_NOT_FOUND,
        'Closing not found',
        payload as Record<string, unknown>,
      );
      finalClosing = {
        ...preview.existingClosing,
        ...payload,
      };
    } else {
      const created = await this.store.create(DAILY_CLOSINGS_COLLECTION, payload as Record<string, unknown>);
      finalClosing = created as unknown as GymDailyClosing;
    }

    // 5. Patron (owner) personellere bildirim ve e-posta gönder
    try {
      await this.notifyOwnersOnDailyClose(finalClosing);
    } catch (err) {
      this.logger.error(\`Gün sonu patron bildirimleri gönderilirken hata oluştu: \${(err as Error).message}\`);
    }

    return finalClosing;`;

let normCode = code.replace(/\r\n/g, '\n');
let normOld = oldReturn.replace(/\r\n/g, '\n');
let normNew = newReturn.replace(/\r\n/g, '\n');

if (!normCode.includes(normOld)) {
  console.error('oldReturn target not found in daily-close.service.ts!');
  process.exit(1);
}

normCode = normCode.replace(normOld, normNew);

// Append notifyOwnersOnDailyClose method right before the last closing brace
const notifyMethod = `
  private async notifyOwnersOnDailyClose(closing: GymDailyClosing): Promise<void> {
    const tenantId = this.store.tenantId();

    // 1. Kulüp adını al
    let gymName = 'OdivonGYM';
    try {
      const gymInfos = await this.store.list<{ gymName?: string; name?: string }>(TENANT_COLLECTION.gymInfo);
      if (gymInfos.length > 0) {
        gymName = gymInfos[0].gymName || gymInfos[0].name || gymName;
      }
    } catch {
      // yoksay
    }

    // 2. Personel Tanımlarında rolü "Patron" (owner) olan aktif personelleri çek
    const allStaff = await this.store.list<GymStaff>(TENANT_COLLECTION.gymStaff);
    const patronStaff = allStaff.filter(
      (s) => s.role === 'owner' && s.status !== 'inactive' && !isDeleted(s as unknown as Record<string, unknown>),
    );

    // 3. users koleksiyonundaki işletme sahibi kullanıcıları al
    let ownerUsers: Array<{ id: string; email: string; displayName: string }> = [];
    try {
      const usersSnap = await this.firebase.db
        .collection(ROOT_COLLECTION.users)
        .where('tenantId', '==', tenantId)
        .where('role', '==', 'owner')
        .get();
      ownerUsers = usersSnap.docs.map((d) => ({
        id: d.id,
        email: String(d.data()['email'] || '').trim().toLowerCase(),
        displayName: String(d.data()['displayName'] || d.data()['email'] || 'Salon Sahibi').trim(),
      }));
    } catch (e) {
      this.logger.warn(\`İşletme sahibi kullanıcıları sorgulanamadı: \${(e as Error).message}\`);
    }

    // 4. Tekilleştirilmiş Patron alıcı listesi oluştur
    interface OwnerContact {
      uid?: string;
      email: string;
      displayName: string;
    }
    const recipientsMap = new Map<string, OwnerContact>();

    // Personel Tanımları (gymStaff)
    for (const staff of patronStaff) {
      const email = (staff.email || '').trim().toLowerCase();
      const key = email || staff.userId || staff.id;
      if (!key) continue;
      recipientsMap.set(key, {
        uid: staff.userId || undefined,
        email,
        displayName: staff.displayName?.trim() || 'Salon Sahibi / Ortak',
      });
    }

    // Kullanıcılar (users koleksiyonu)
    for (const u of ownerUsers) {
      const key = u.email || u.id;
      if (!recipientsMap.has(key)) {
        recipientsMap.set(key, {
          uid: u.id,
          email: u.email,
          displayName: u.displayName,
        });
      } else {
        const existing = recipientsMap.get(key)!;
        if (!existing.uid) existing.uid = u.id;
      }
    }

    const recipients = Array.from(recipientsMap.values());
    const targetUids = recipients.map((r) => r.uid).filter(Boolean) as string[];

    // 5. In-App Bildirim (platformNotifications) -> Çan simgesi & Bildirim Merkezi için
    try {
      const notifRef = this.firebase.db
        .collection(tenantCollectionPath(tenantId, 'platformNotifications'))
        .doc();

      const cashDiff = Number(closing.cashDifference || 0);
      let diffText = 'Kasa Tam (Fark Yok)';
      if (cashDiff < 0) {
        diffText = \`Kasa Eksiği: \${cashDiff.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺\`;
      } else if (cashDiff > 0) {
        diffText = \`Kasa Fazlası: +\${cashDiff.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺\`;
      }

      const notifDoc: TenantNotificationDoc = {
        id: notifRef.id,
        broadcastId: \`daily_close_\${closing.id || notifRef.id}\`,
        campaignId: null,
        title: \`Gün Sonu Kapanışı (Z Raporu): \${closing.closingNumber}\`,
        body: \`\${closing.date} tarihli kasa gün sonu \${closing.closedByStaffName} tarafından tamamlandı. Sayılan Nakit: \${Number(closing.actualCashCounted || 0).toLocaleString('tr-TR')} ₺ | Fiziki POS: \${Number(closing.actualPosCounted || 0).toLocaleString('tr-TR')} ₺. \${diffText}.\`,
        level: cashDiff !== 0 ? 'warning' : 'success',
        link: '/admin/accounting?tab=daily-close',
        linkLabel: 'Z Raporunu İncele',
        createdAt: new Date().toISOString(),
        expiresAt: null,
        readBy: [],
        deletedAt: null,
        targetRoles: ['owner'],
        targetUids: targetUids.length > 0 ? targetUids : undefined,
        category: 'accounting',
      };

      await notifRef.set(notifDoc);
      this.logger.log(\`Gün sonu patron içi platform bildirimi kaydedildi: \${notifRef.id}\`);
    } catch (notifErr) {
      this.logger.error(\`Gün sonu platform bildirimi kaydedilemedi: \${(notifErr as Error).message}\`);
    }

    // 6. Patronlara Gün Sonu Özet E-postası Gönder
    for (const recipient of recipients) {
      if (recipient.email && recipient.email.includes('@')) {
        this.mailService.sendDailyCloseEmail({
          to: recipient.email,
          recipientName: recipient.displayName,
          closingNumber: closing.closingNumber,
          date: closing.date,
          closedByStaffName: closing.closedByStaffName,
          openingCash: closing.openingCash,
          actualCashCounted: closing.actualCashCounted,
          expectedCash: closing.expectedCash,
          cashDifference: closing.cashDifference,
          actualPosCounted: closing.actualPosCounted,
          expectedPos: closing.expectedPos,
          posDifference: closing.posDifference,
          retainedCashForNextDay: closing.retainedCashForNextDay,
          bankDepositAmount: closing.bankDepositAmount,
          notes: closing.notes,
          branchName: closing.branchName,
          gymName,
        }).catch((err) => {
          this.logger.warn(\`Gün sonu e-postası iletilemedi (\${recipient.email}): \${(err as Error).message}\`);
        });
      }
    }
  }
}
`;

const lastBraceIdx = normCode.lastIndexOf('}');
normCode = normCode.slice(0, lastBraceIdx) + notifyMethod;

fs.writeFileSync(path, normCode.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully updated daily-close.service.ts!');

