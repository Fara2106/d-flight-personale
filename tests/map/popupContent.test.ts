// tests/map/popupContent.test.ts
import { it, expect, vi } from 'vitest';
import { buildPopupContent } from '../../src/map/popupContent';

const zoneA = { id: 'a', name: 'Alfa', restrictionType: 'conditional',
  label: '≤ 60 m', upperLimitM: 60, verticalRef: 'AGL', message: 'Nota A', applicabilityText: null };
const zoneP = { id: 'p', name: 'Papa', restrictionType: 'prohibited',
  label: '⛔ 0 m', upperLimitM: 0, verticalRef: 'AGL', message: null, applicabilityText: 'MON 08:00–20:00' };

it('dedup per id e ordinamento per restrittività (prohibited primo)', () => {
  const el = buildPopupContent([zoneA, zoneP, zoneA]);
  const names = [...el.querySelectorAll('.zone-popup-head strong')].map(n => n.textContent);
  expect(names).toEqual(['Papa', 'Alfa']);
});

it('multi-zona: dettagli chiusi in partenza', () => {
  const el = buildPopupContent([zoneA, zoneP]);
  const details = [...el.querySelectorAll('.zone-popup-detail')] as HTMLElement[];
  expect(details).toHaveLength(2);
  expect(details.every(d => d.hidden)).toBe(true);
});

it('click su un nome apre solo quel dettaglio e notifica il focus', () => {
  const focus = vi.fn();
  const el = buildPopupContent([zoneA, zoneP], focus);
  const heads = [...el.querySelectorAll('.zone-popup-head')] as HTMLElement[];
  heads[1].click(); // Alfa
  const details = [...el.querySelectorAll('.zone-popup-detail')] as HTMLElement[];
  expect(details[1].hidden).toBe(false);
  expect(details[0].hidden).toBe(true);
  expect(focus).toHaveBeenLastCalledWith('a');
  heads[0].click(); // Papa: chiude Alfa
  expect(details[0].hidden).toBe(false);
  expect(details[1].hidden).toBe(true);
  expect(focus).toHaveBeenLastCalledWith('p');
});

it('ri-click sulla zona aperta la chiude e azzera il focus', () => {
  const focus = vi.fn();
  const el = buildPopupContent([zoneA, zoneP], focus);
  const head = el.querySelector('.zone-popup-head') as HTMLElement;
  head.click();
  head.click();
  expect(focus).toHaveBeenLastCalledWith(null);
  const detail = el.querySelector('.zone-popup-detail') as HTMLElement;
  expect(detail.hidden).toBe(true);
});

it('singola zona: parte aperta e con focus', () => {
  const focus = vi.fn();
  const el = buildPopupContent([zoneA], focus);
  const detail = el.querySelector('.zone-popup-detail') as HTMLElement;
  expect(detail.hidden).toBe(false);
  expect(focus).toHaveBeenLastCalledWith('a');
});

it('il dettaglio mostra quota, message e finestra di attività (solo textContent)', () => {
  const el = buildPopupContent([zoneP]);
  const detail = el.querySelector('.zone-popup-detail') as HTMLElement;
  expect(detail.textContent).toContain('0 m AGL');
  expect(detail.textContent).toContain('MON 08:00–20:00');
  expect(el.innerHTML).not.toContain('<script');
});

it('linguaggio semplice in primo piano: frase concreta, gergo nei "Dettagli tecnici" chiusi', () => {
  const el = buildPopupContent([zoneA]);
  const detail = el.querySelector('.zone-popup-detail') as HTMLElement;
  // la prima cosa che si legge è la frase per principianti, non il gergo
  const plain = detail.querySelector('.zone-popup-plain') as HTMLElement;
  expect(plain).not.toBeNull();
  expect(plain.textContent).toBe('Si può volare, ma con condizioni da rispettare');
  expect(detail.textContent).toContain('Quota massima qui: 60 m dal suolo');
  // i dettagli tecnici esistono ma sono in secondo piano (details collassato)
  const tech = detail.querySelector('details.zone-popup-tech') as HTMLDetailsElement;
  expect(tech).not.toBeNull();
  expect(tech.open).toBe(false);
  expect(tech.querySelector('summary')?.textContent).toBe('Dettagli tecnici');
  expect(tech.textContent).toContain('60 m AGL');       // quota raw
  expect(tech.textContent).toContain('conditional');     // tipo ED-269 raw
  expect(tech.textContent).toContain('Nota A');          // message raw ED-269
});

it('la zona vietata apre con il divieto in chiaro', () => {
  const el = buildPopupContent([zoneP]);
  const plain = el.querySelector('.zone-popup-plain') as HTMLElement;
  expect(plain.textContent).toBe('Vietato far volare il drone qui');
});
