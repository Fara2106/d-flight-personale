import type { Ed269Document } from './ed269.types';

export class Ed269ParseError extends Error {}

export function parseEd269(input: string | unknown): Ed269Document {
  let obj: any;
  if (typeof input === 'string') {
    try { obj = JSON.parse(input); }
    catch { throw new Ed269ParseError('File non valido: JSON non leggibile.'); }
  } else { obj = input; }

  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.features)) {
    throw new Ed269ParseError(
      'Struttura non riconosciuta: manca l\'elenco "features" del formato ED-269.'
    );
  }
  return obj as Ed269Document;
}
