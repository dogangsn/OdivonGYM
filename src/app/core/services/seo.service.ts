import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface SeoConfig {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  robots?: string;
}

const DEFAULT_SEO: SeoConfig = {
  title: 'OdivonGYM · Yeni Nesil Spor Salonu ve Üye Yönetim Platformu',
  description:
    'OdivonGYM ile spor salonunuzu, antrenörlerinizi, turnike ve QR geçişlerinizi, e-fatura ve üye cüzdanlarınızı tek ekrandan modern ve güvenli bir şekilde yönetin.',
  keywords:
    'spor salonu yazılımı, gym management, üye takip programı, turnike geçiş sistemi, qr giriş, pt randevu, sporcu cüzdanı, fitness otomasyonu',
  ogImage: 'https://gym.odivon.com/images/athletes/hero-workout.jpg',
  canonicalUrl: 'https://gym.odivon.com',
  robots: 'index, follow',
};

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  /** Router olaylarını dinleyerek aktif rota verisindeki SEO meta etiketlerini uygular */
  init(): void {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        let route = this.activatedRoute;
        while (route.firstChild) {
          route = route.firstChild;
        }

        const data = route.snapshot.data;
        const pageTitle = route.snapshot.title || data['title'];

        this.updateMeta({
          title: pageTitle ? `${pageTitle}` : DEFAULT_SEO.title,
          description: data['description'] || DEFAULT_SEO.description,
          keywords: data['keywords'] || DEFAULT_SEO.keywords,
          ogTitle: data['ogTitle'] || pageTitle || DEFAULT_SEO.title,
          ogDescription: data['ogDescription'] || data['description'] || DEFAULT_SEO.description,
          ogImage: data['ogImage'] || DEFAULT_SEO.ogImage,
          canonicalUrl: `https://gym.odivon.com${this.router.url.split('?')[0]}`,
        });
      });
  }

  /** Belirli bir sayfa için dinamik meta etiketlerini günceller */
  updateMeta(config: SeoConfig): void {
    const fullTitle = config.title
      ? config.title.includes('OdivonGYM')
        ? config.title
        : `${config.title} · OdivonGYM`
      : DEFAULT_SEO.title!;

    this.titleService.setTitle(fullTitle);

    const desc = config.description || DEFAULT_SEO.description!;
    const keywords = config.keywords || DEFAULT_SEO.keywords!;
    const ogImg = config.ogImage || DEFAULT_SEO.ogImage!;
    const canonical = config.canonicalUrl || DEFAULT_SEO.canonicalUrl!;
    const robots = config.robots || DEFAULT_SEO.robots!;

    // Standard Meta Tags
    this.metaService.updateTag({ name: 'description', content: desc });
    this.metaService.updateTag({ name: 'keywords', content: keywords });
    this.metaService.updateTag({ name: 'robots', content: robots });

    // OpenGraph
    this.metaService.updateTag({ property: 'og:title', content: config.ogTitle || fullTitle });
    this.metaService.updateTag({ property: 'og:description', content: config.ogDescription || desc });
    this.metaService.updateTag({ property: 'og:image', content: ogImg });
    this.metaService.updateTag({ property: 'og:url', content: canonical });
    this.metaService.updateTag({ property: 'og:type', content: 'website' });
    this.metaService.updateTag({ property: 'og:site_name', content: 'OdivonGYM' });

    // Twitter Card
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: config.ogTitle || fullTitle });
    this.metaService.updateTag({ name: 'twitter:description', content: config.ogDescription || desc });
    this.metaService.updateTag({ name: 'twitter:image', content: ogImg });

    // Canonical Link
    this.updateCanonicalUrl(canonical);
  }

  private updateCanonicalUrl(url: string): void {
    if (typeof document === 'undefined') return;
    let link: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
