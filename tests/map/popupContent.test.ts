import { it, expect } from 'vitest';
import { buildPopupContent } from '../../src/map/popupContent';

const zone = (over: Record<string, unknown> = {}) => ({
  id: 'z1', name: 'CTR Roma', restrictionType: 'auth_required',
  label: '⚠️ 45 m', upperLimitM: 45, verticalRef: 'AGL', ...over,
});

it('rende nome, etichetta e quota max di una zona', () => {
  const el = buildPopupContent([zone()]);
  expect(el.className).toBe('zone-popup');
  const items = el.querySelectorAll('.zone-popup-item');
  expect(items).toHaveLength(1);
  expect(items[0].textContent).toContain('CTR Roma');
  expect(items[0].textContent).toContain('⚠️ 45 m');
  expect(items[0].textContent).toContain('Quota max: 45 m AGL');
});

it('mostra — quando la quota max è assente', () => {
  const el = buildPopupContent([zone({ upperLimitM: null, verticalRef: null })]);
  expect(el.textContent).toContain('Quota max: —');
});

it('deduplica le zone con lo stesso id', () => {
  const el = buildPopupContent([zone(), zone(), zone({ id: 'z2', name: 'P-Zona' })]);
  expect(el.querySelectorAll('.zone-popup-item')).toHaveLength(2);
});

it('ordina per restrittività: prohibited prima, none in fondo, sconosciute in coda', () => {
  const el = buildPopupContent([
    zone({ id: 'a', name: 'Verde', restrictionType: 'none' }),
    zone({ id: 'b', name: 'Ignota', restrictionType: 'boh' }),
    zone({ id: 'c', name: 'Rossa', restrictionType: 'prohibited' }),
    zone({ id: 'd', name: 'Gialla', restrictionType: 'conditional' }),
  ]);
  const names = [...el.querySelectorAll('.zone-popup-item strong')].map((n) => n.textContent);
  expect(names).toEqual(['Rossa', 'Gialla', 'Verde', 'Ignota']);
});

it('colora il pallino secondo il tipo di restrizione, grigio se sconosciuto', () => {
  const el = buildPopupContent([
    zone({ id: 'a', restrictionType: 'prohibited' }),
    zone({ id: 'b', restrictionType: 'boh' }),
  ]);
  const dots = [...el.querySelectorAll('.zone-popup-dot')] as HTMLElement[];
  expect(dots[0].style.backgroundColor).toBe('rgb(239, 68, 68)'); // #ef4444
  expect(dots[1].style.backgroundColor).toBe('rgb(136, 136, 136)'); // #888888
});
