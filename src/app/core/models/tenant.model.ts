import { Timestamp } from '@angular/fire/firestore';

/**
 * `tenants/{tenantId}` koleksiyonundaki doküman şekli — bir spor salonunu
 * temsil eder. Yalnızca Cloud Functions (Admin SDK) tarafından yazılır; bkz.
 * `functions/src/tenant/create-tenant-with-admin.ts` ve `firestore.rules`.
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  /** Bu tenant'ı oluşturan kullanıcının uid'i — Spark planında (Cloud Functions/Custom Claims yok) `firestore.rules`'ın "sadece bu kişi bu tenant'ın admin'i olabilir" kontrolünün dayandığı tek alan. */
  ownerUid: string;
  createdAt: Timestamp;
}
