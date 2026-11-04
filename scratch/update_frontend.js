const fs = require('fs');

// 1. notification-center.service.ts
const notifPath = 'C:/Users/dogan/Documents/Private/Project/OdivonGYM/src/app/core/services/notification-center.service.ts';
let notifCode = fs.readFileSync(notifPath, 'utf8');
notifCode = notifCode.replace(
  "icon: n.level === 'critical' ? 'priority_high' : n.level === 'warning' ? 'warning' : 'campaign',",
  "icon: n.level === 'critical' ? 'priority_high' : n.title?.includes('Z Raporu') || n.title?.includes('Gün Sonu') ? 'receipt_long' : n.level === 'warning' ? 'warning' : 'campaign',"
);
fs.writeFileSync(notifPath, notifCode, 'utf8');
console.log('notification-center.service.ts updated!');

// 2. admin-accounting.ts
const accPath = 'C:/Users/dogan/Documents/Private/Project/OdivonGYM/src/app/admin/accounting/admin-accounting.ts';
let accCode = fs.readFileSync(accPath, 'utf8');

// Add ActivatedRoute to router import
accCode = accCode.replace(
  "import { RouterLink } from '@angular/router';",
  "import { ActivatedRoute, RouterLink } from '@angular/router';\nimport { NotificationCenterService } from '../../core/services/notification-center.service';"
);

// Inject ActivatedRoute & NotificationCenterService
accCode = accCode.replace(
  "protected readonly reminderService = inject(DailyCloseReminderService);",
  "protected readonly reminderService = inject(DailyCloseReminderService);\n  private readonly route = inject(ActivatedRoute);\n  private readonly notificationCenter = inject(NotificationCenterService);"
);

// Read queryParam tab in ngOnInit
accCode = accCode.replace(
  "ngOnInit(): void {\n    this.service.seedDefaultCategoriesIfEmpty().catch(() => {});",
  "ngOnInit(): void {\n    const tabParam = this.route.snapshot.queryParamMap.get('tab');\n    if (tabParam === 'daily-close' || tabParam === 'analytics') {\n      this.activeTab.set(tabParam as MainTab);\n    }\n    this.service.seedDefaultCategoriesIfEmpty().catch(() => {});"
);

// Reload notifications after submitDailyClose
accCode = accCode.replace(
  "this.alertService.toastSuccess(`Z Raporu oluşturuldu: ${res.closingNumber}`);",
  "this.alertService.toastSuccess(`Z Raporu oluşturuldu: ${res.closingNumber}`);\n      this.notificationCenter.reload().catch(() => {});"
);

fs.writeFileSync(accPath, accCode, 'utf8');
console.log('admin-accounting.ts updated!');

