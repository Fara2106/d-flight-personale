import { describe, it, expect } from 'vitest';
import { plainZoneInfo, parseReasons, plainGroupedZoneInfo } from '../../src/map/plainLanguage';

describe('plainZoneInfo: frasi semplici per principianti dai campi ED-269', () => {
  it('headline concreta per ogni tipo di restrizione', () => {
    expect(plainZoneInfo({ restrictionType: 'prohibited' }).headline)
      .toBe('Vietato far volare il drone qui');
    expect(plainZoneInfo({ restrictionType: 'auth_required' }).headline)
      .toBe("Serve un'autorizzazione per volare qui");
    expect(plainZoneInfo({ restrictionType: 'conditional' }).headline)
      .toBe('Si può volare, ma con condizioni da rispettare');
    expect(plainZoneInfo({ restrictionType: 'none' }).headline)
      .toBe('Si può volare seguendo le regole generali');
  });

  it('tipo sconosciuto: invito prudente a verificare', () => {
    const { headline } = plainZoneInfo({ restrictionType: 'boh' });
    expect(headline).toContain('verifica');
  });

  it('quota AGL in parole semplici', () => {
    const { lines } = plainZoneInfo(
      { restrictionType: 'conditional', upperLimitM: 60, verticalRef: 'AGL' });
    expect(lines).toContain('Quota massima qui: 60 m dal suolo');
  });

  it('quota AMSL: avvisa che non è l\'altezza dal suolo (mai convertita)', () => {
    const { lines } = plainZoneInfo(
      { restrictionType: 'auth_required', upperLimitM: 300, verticalRef: 'AMSL' });
    const row = lines.find((l) => l.includes('300 m'));
    expect(row).toBeDefined();
    expect(row).toContain('livello del mare');
    expect(row).toContain('non è l\'altezza dal suolo');
  });

  it('zona vietata: nessuna riga quota (il divieto assorbe)', () => {
    const { lines } = plainZoneInfo(
      { restrictionType: 'prohibited', upperLimitM: 0, verticalRef: 'AGL' });
    expect(lines.some((l) => l.includes('Quota'))).toBe(false);
  });

  it('motivi ED-269 tradotti in linguaggio comune (es. zona aeroportuale)', () => {
    const { lines } = plainZoneInfo(
      { restrictionType: 'auth_required', reasons: ['AIR_TRAFFIC'] });
    const row = lines.find((l) => l.startsWith('Motivo'));
    expect(row).toContain('aeroport');
  });

  it('reasons serializzati da MapLibre come stringa JSON vengono comunque letti', () => {
    const { lines } = plainZoneInfo(
      { restrictionType: 'none', reasons: '["NATURE","SBAGLIATO"]' });
    const row = lines.find((l) => l.startsWith('Motivo'));
    expect(row).toContain('natur');
    expect(row).not.toContain('SBAGLIATO'); // codici ignoti non mostrati
  });

  it('zona non permanente: dice chiaramente che non è sempre attiva', () => {
    const { lines } = plainZoneInfo(
      { restrictionType: 'conditional', applicabilityText: 'LUN–VEN 08:00–20:00' });
    const row = lines.find((l) => l.includes('LUN–VEN 08:00–20:00'));
    expect(row).toContain('Non è sempre attiva');
  });
});

describe('parseReasons', () => {
  it('accetta array, stringa JSON e input invalidi', () => {
    expect(parseReasons(['A', 'B'])).toEqual(['A', 'B']);
    expect(parseReasons('["A"]')).toEqual(['A']);
    expect(parseReasons('non-json [')).toEqual([]);
    expect(parseReasons(undefined)).toEqual([]);
    expect(parseReasons(42)).toEqual([]);
  });
});

describe('plainGroupedZoneInfo: raggruppamento per nome', () => {
  it('zone con nome diverso → una voce ciascuna', () => {
    const items = [
      { name: 'Alpha', restrictionType: 'conditional', upperLimitM: 60, verticalRef: 'AGL' },
      { name: 'Beta', restrictionType: 'prohibited', upperLimitM: 0, verticalRef: 'AGL' },
    ];
    const result = plainGroupedZoneInfo(items);
    expect(result).toHaveLength(2);
    expect(result[0]!.headline).toBe('Vietato far volare il drone qui');
    expect(result[0]!.name).toBe('Beta');
    expect(result[1]!.headline).toBe('Si può volare, ma con condizioni da rispettare');
  });

  it('zone con nome identico → una voce con fasce multiple', () => {
    const items = [
      { id: 'x1', name: 'Linate', restrictionType: 'auth_required', upperLimitM: 120, lowerLimitM: 0, verticalRef: 'AGL' },
      { id: 'x2', name: 'Linate', restrictionType: 'auth_required', upperLimitM: 120, lowerLimitM: 30, verticalRef: 'AGL' },
    ];
    const result = plainGroupedZoneInfo(items);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Linate');
    expect(result[0]!.bandId).toBe('x1'); // bandId = id della banda più restrittiva
    expect(result[0]!.bands).toHaveLength(2);
    expect(result[0]!.bands[0]!.lowerM).toBe(0);
    expect(result[0]!.bands[1]!.lowerM).toBe(30);
  });

  it('la fascia principale è la più restrittiva', () => {
    const items = [
      { name: 'X', restrictionType: 'conditional', upperLimitM: 100, lowerLimitM: 0, verticalRef: 'AGL' },
      { name: 'X', restrictionType: 'auth_required', upperLimitM: 100, lowerLimitM: 0, verticalRef: 'AGL' },
    ];
    const result = plainGroupedZoneInfo(items);
    expect(result[0]!.mainRestrictionType).toBe('auth_required');
    expect(result[0]!.headline).toBe("Serve un'autorizzazione per volare qui");
  });

  it('nomi senza nome → raggruppati sotto "(senza nome)"', () => {
    const items = [
      { restrictionType: 'conditional', upperLimitM: 50, verticalRef: 'AGL' },
      { restrictionType: 'conditional', upperLimitM: 50, verticalRef: 'AGL' },
    ];
    const result = plainGroupedZoneInfo(items);
    expect(result).toHaveLength(1);
    expect(result[0]!.headline).toBe('Si può volare, ma con condizioni da rispettare');
  });
});
