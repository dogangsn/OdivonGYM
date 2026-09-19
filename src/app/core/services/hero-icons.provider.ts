import { inject, provideAppInitializer } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

/** Odivon design system'de `[svgIcon]="'heroicons_solid:bolt'"` gibi kullanılan ikonlar. */
const SOLID_ICONS = [
  'bolt',
  'wallet',
  'shield-check',
  'fire',
  'calendar-days',
  'qr-code',
  'check-circle',
  'beaker',
  'scale',
  'user-plus',
  'magnifying-glass',
  'users',
  'arrow-trending-up',
  'clock',
  'banknotes',
  'information-circle',
];

const OUTLINE_ICONS = ['pencil', 'x-mark'];

/**
 * heroicons paketinden `public/icons/heroicons/**` altına kopyalanan SVG'leri
 * `heroicons_solid:*` / `heroicons_outline:*` namespace'leriyle kaydeder —
 * bkz. `.agents/skills/odivon-ui-design-system` (Odivon Design System).
 */
export function provideHeroIcons() {
  return provideAppInitializer(() => {
    const registry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);

    for (const name of SOLID_ICONS) {
      registry.addSvgIconInNamespace(
        'heroicons_solid',
        name,
        sanitizer.bypassSecurityTrustResourceUrl(`icons/heroicons/solid/${name}.svg`),
      );
    }
    for (const name of OUTLINE_ICONS) {
      registry.addSvgIconInNamespace(
        'heroicons_outline',
        name,
        sanitizer.bypassSecurityTrustResourceUrl(`icons/heroicons/outline/${name}.svg`),
      );
    }
  });
}
