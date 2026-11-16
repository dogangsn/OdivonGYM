import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface SeoConfig {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  robots?: string;
}

export const SITE_ORIGIN = 'https://gym.odivon.com';

const INDEX = 'index, follow, max-image-preview:large';
/** Panel, giriş ve ödeme ekranları arama sonuçlarına girmesin. */
const NO_INDEX = 'noindex, nofollow';

const DEFAULT_SEO: Required<Pick<SeoConfig, 'title' | 'description' | 'ogImage'>> = {
  title: 'OdivonGYM · Spor Salonu Yönetim Yazılımı ve Turnike Entegrasyonu',
  description:
    'Spor salonu yönetim yazılımı: üyelik takibi, turnike ve QR geçiş, online ödeme, taksit ve borç takibi, grup dersleri ve raporlar tek panelde. 14 gün ücretsiz deneyin.',
  ogImage: `${SITE_ORIGIN}/images/og/odivongym-og.jpg`,
};

/**
 * Rota verisinden başlık, açıklama, robots ve canonical etiketlerini uygular.
 *
 * Yalnızca `data: { seoIndex: true }` taşıyan rotalar (tanıtım, kullanım şartları,
 * gizlilik) indekslenir; diğer her rota `noindex` alır. Böylece yeni eklenen bir panel
 * ekranı unutulsa bile arama sonuçlarına düşmez.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);

  init(): void {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        let route = this.activatedRoute;
        while (route.firstChild) {
          route = route.firstChild;
        }

        const data = route.snapshot.data;
        const pageTitle = route.snapshot.title || data['title'];
        const indexable = data['seoIndex'] === true;
        const path = event.urlAfterRedirects.split(/[?#]/)[0] || '/';

        this.updateMeta({
          title: pageTitle || DEFAULT_SEO.title,
          description: data['description'] || DEFAULT_SEO.description,
          ogTitle: data['ogTitle'] || pageTitle || DEFAULT_SEO.title,
          ogDescription: data['ogDescription'] || data['description'] || DEFAULT_SEO.description,
          ogImage: data['ogImage'] || DEFAULT_SEO.ogImage,
          canonicalUrl: `${SITE_ORIGIN}${path}`,
          robots: indexable ? INDEX : NO_INDEX,
        });
      });
  }

  updateMeta(config: SeoConfig): void {
    const fullTitle = config.title
      ? config.title.includes('OdivonGYM')
        ? config.title
        : `${config.title} · OdivonGYM`
      : DEFAULT_SEO.title;

    this.titleService.setTitle(fullTitle);

    const desc = config.description || DEFAULT_SEO.description;
    const ogImg = config.ogImage || DEFAULT_SEO.ogImage;
    const canonical = config.canonicalUrl || `${SITE_ORIGIN}/`;

    this.metaService.updateTag({ name: 'description', content: desc });
    this.metaService.updateTag({ name: 'robots', content: config.robots || NO_INDEX });

    this.metaService.updateTag({ property: 'og:title', content: config.ogTitle || fullTitle });
    this.metaService.updateTag({ property: 'og:description', content: config.ogDescription || desc });
    this.metaService.updateTag({ property: 'og:image', content: ogImg });
    this.metaService.updateTag({ property: 'og:url', content: canonical });

    this.metaService.updateTag({ name: 'twitter:title', content: config.ogTitle || fullTitle });
    this.metaService.updateTag({ name: 'twitter:description', content: config.ogDescription || desc });
    this.metaService.updateTag({ name: 'twitter:image', content: ogImg });

    this.updateCanonicalUrl(canonical);
  }

  private updateCanonicalUrl(url: string): void {
    let link: HTMLLinkElement | null = this.document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
