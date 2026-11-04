const fs = require('fs');

// 1. crm-notifications.service.ts
const crmPath = 'C:/Users/dogan/Documents/Private/Project/OdivonMainApi/src/modules/platform/crm/crm-notifications.service.ts';
let crmCode = fs.readFileSync(crmPath, 'utf8');

crmCode = crmCode.replace(
`export interface TenantNotificationDoc {
  id: string;
  broadcastId: string;
  campaignId: string | null;
  title: string;
  body: string;
  level: NotificationLevel;
  link: string | null;
  linkLabel: string | null;
  createdAt: string;
  expiresAt: string | null;
  /** Uids of tenant users who have read it. */
  readBy: string[];
  deletedAt: string | null;
}`,
`export interface TenantNotificationDoc {
  id: string;
  broadcastId: string;
  campaignId: string | null;
  title: string;
  body: string;
  level: NotificationLevel;
  link: string | null;
  linkLabel: string | null;
  createdAt: string;
  expiresAt: string | null;
  /** Uids of tenant users who have read it. */
  readBy: string[];
  deletedAt: string | null;
  targetRoles?: string[];
  targetUids?: string[];
  category?: string;
}`
);

const oldListForTenant = `  async listForTenant(tenantId: string, uid: string, opts: { unreadOnly?: boolean; limit?: number }) {
    const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
    const snap = await this.tenantCollection(tenantId).orderBy('createdAt', 'desc').limit(limit).get();
    const now = new Date().toISOString();
    const items = snap.docs
      .map((d) => d.data() as TenantNotificationDoc)
      .filter((n) => !n.deletedAt && (!n.expiresAt || n.expiresAt > now))
      .map(({ readBy, ...n }) => ({ ...n, read: (readBy ?? []).includes(uid) }))
      .filter((n) => !opts.unreadOnly || !n.read);
    return { items, unreadCount: items.filter((n) => !n.read).length };
  }`;

const newListForTenant = `  async listForTenant(
    tenantId: string,
    uid: string,
    opts: { unreadOnly?: boolean; limit?: number; userRole?: string },
  ) {
    const limit = Math.min(100, Math.max(1, opts.limit ?? 30));
    const snap = await this.tenantCollection(tenantId).orderBy('createdAt', 'desc').limit(limit).get();
    const now = new Date().toISOString();
    const items = snap.docs
      .map((d) => d.data() as TenantNotificationDoc)
      .filter((n) => !n.deletedAt && (!n.expiresAt || n.expiresAt > now))
      .filter((n) => {
        if (n.targetRoles && n.targetRoles.length > 0) {
          const matchesRole = Boolean(opts.userRole && n.targetRoles.includes(opts.userRole));
          const matchesUid = Boolean(n.targetUids && n.targetUids.length > 0 && n.targetUids.includes(uid));
          if (!matchesRole && !matchesUid) {
            return false;
          }
        } else if (n.targetUids && n.targetUids.length > 0) {
          if (!n.targetUids.includes(uid)) {
            return false;
          }
        }
        return true;
      })
      .map(({ readBy, ...n }) => ({ ...n, read: (readBy ?? []).includes(uid) }))
      .filter((n) => !opts.unreadOnly || !n.read);
    return { items, unreadCount: items.filter((n) => !n.read).length };
  }`;

let normCrm = crmCode.replace(/\r\n/g, '\n');
let normOld = oldListForTenant.replace(/\r\n/g, '\n');
let normNew = newListForTenant.replace(/\r\n/g, '\n');

if (normCrm.includes(normOld)) {
  normCrm = normCrm.replace(normOld, normNew);
  fs.writeFileSync(crmPath, normCrm.replace(/\n/g, '\r\n'), 'utf8');
  console.log('crm-notifications.service.ts updated!');
} else {
  console.log('listForTenant target not found in crm-notifications.service.ts');
}

// 2. tenant-notifications.controller.ts
const ctrlPath = 'C:/Users/dogan/Documents/Private/Project/OdivonMainApi/src/modules/platform/crm/tenant-notifications.controller.ts';
let ctrlCode = fs.readFileSync(ctrlPath, 'utf8');
ctrlCode = ctrlCode.replace(
`    return this.notifications.listForTenant(user.tenantId, user.userId, {
      unreadOnly: query.unreadOnly === 'true',
      limit: Number(query.limit) || undefined,
    });`,
`    return this.notifications.listForTenant(user.tenantId, user.userId, {
      unreadOnly: query.unreadOnly === 'true',
      limit: Number(query.limit) || undefined,
      userRole: user.role,
    });`
);
fs.writeFileSync(ctrlPath, ctrlCode, 'utf8');
console.log('tenant-notifications.controller.ts updated!');

