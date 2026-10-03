import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OdvBarChart, OdvDonutChart, OdvLineChart, seriesColor } from './odv-charts';

describe('odv charts', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  it('draws bars relative to the largest value and shows the tooltip on hover', async () => {
    const fixture = TestBed.createComponent(OdvBarChart);
    fixture.componentRef.setInput('data', [
      { label: 'Pzt', value: 5 },
      { label: 'Sal', value: 10 },
      { label: 'Çar', value: 0 },
    ]);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const bars = Array.from(el.querySelectorAll<HTMLElement>('.rounded-t'));
    expect(bars.map((bar) => bar.style.height)).toEqual(['50%', '100%', '0%']);
    expect(el.textContent).toContain('Sal');

    const cells = el.querySelectorAll<HTMLElement>('[tabindex="0"]');
    cells[1].dispatchEvent(new Event('mouseenter'));
    await fixture.whenStable();
    expect(el.querySelector('.odv-chart-tip')?.textContent).toContain('Sal: 10');
  });

  it('draws one polyline per series with a legend for several series', async () => {
    const fixture = TestBed.createComponent(OdvLineChart);
    fixture.componentRef.setInput('labels', ['Oca', 'Şub', 'Mar']);
    fixture.componentRef.setInput('series', [
      { name: 'Gelir', values: [100, 200, 150], colorIndex: 0 },
      { name: 'Gider', values: [50, 80, 60], colorIndex: 1 },
    ]);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const lines = el.querySelectorAll('polyline');
    expect(lines.length).toBe(2);
    expect(lines[0].getAttribute('points')?.split(' ').length).toBe(3);
    expect(el.textContent).toContain('Gelir');
    expect(el.textContent).toContain('Gider');
  });

  it('keeps a slice colour tied to its entity and skips empty slices', async () => {
    const fixture = TestBed.createComponent(OdvDonutChart);
    fixture.componentRef.setInput('data', [
      { label: 'Aktif', value: 3, colorIndex: 0 },
      { label: 'Deneme', value: 0, colorIndex: 2 },
      { label: 'İptal', value: 1, colorIndex: 6 },
    ]);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const items = Array.from(el.querySelectorAll('li')).map((li) =>
      Array.from(li.children)
        .map((child) => child.textContent?.trim())
        .filter(Boolean)
        .join(' '),
    );
    expect(items).toEqual(['Aktif 3 %75', 'İptal 1 %25']);
    expect(el.querySelectorAll('circle').length).toBe(3); // track + 2 slices
    expect(seriesColor(6)).toContain('#4a3aa7');
  });
});
