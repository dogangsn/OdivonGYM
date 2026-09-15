import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Tüm fonksiyonların paylaştığı tek Admin SDK / Firestore örneği.
initializeApp();

export const db = getFirestore();

/** AuthService.ts (client) ile birebir aynı süre — bkz. environment.ts. */
export const TRIAL_DURATION_DAYS = 14;
