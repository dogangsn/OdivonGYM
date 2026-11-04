const fs = require('fs');

// 1. Fix mail.service.ts
const mailPath = 'C:/Users/dogan/Documents/Private/Project/OdivonMainApi/src/shared/mail/mail.service.ts';
let mailCode = fs.readFileSync(mailPath, 'utf8');
mailCode = mailCode.replace(
  'const fmtMoney = (val) => (Number(val || 0)).toLocaleString',
  'const fmtMoney = (val: number | undefined | null) => (Number(val || 0)).toLocaleString'
);
fs.writeFileSync(mailPath, mailCode, 'utf8');

// 2. Fix daily-close.service.ts
const dailyPath = 'C:/Users/dogan/Documents/Private/Project/OdivonMainApi/src/modules/gym/ops/daily-close/daily-close.service.ts';
let dailyCode = fs.readFileSync(dailyPath, 'utf8');
dailyCode = dailyCode.replace(
  'const gymInfos = await this.store.list<{ gymName?: string; name?: string }>(TENANT_COLLECTION.gymInfo);',
  'const gymInfos = await this.store.list<Doc & { gymName?: string; name?: string }>(TENANT_COLLECTION.gymInfo);'
);
fs.writeFileSync(dailyPath, dailyCode, 'utf8');

console.log('Fixed both TS errors!');

