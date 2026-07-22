import type { RestrictionType } from '../data/ed269.types';

export function mapStyleUrl(theme: 'light' | 'dark'): string {
  const name = theme === 'dark' ? 'dark-matter-gl-style' : 'positron-gl-style';
  return `https://basemaps.cartocdn.com/gl/${name}/style.json`;
}

/** Palette desaturata in stile carta aeronautica (feedback iPhone 2026-07-10):
 *  gli arancioni pieni "impastavano" il tema scuro. Il rosso resta il segnale
 *  più acceso; le altre categorie sono via via più discrete. */
export const ZONE_COLORS: Record<RestrictionType, string> = {
  prohibited: '#e5484d', auth_required: '#d98f3d',
  conditional: '#c9b23c', none: '#4fae63',
};

/** 0 = più restrittivo. Unica fonte per l'ordinamento del popup e del rendering. */
export const RESTRICTION_ORDER: Record<RestrictionType, number> = {
  prohibited: 0, auth_required: 1, conditional: 2, none: 3,
};

/** Riempimenti LEGGERI: la mappa base (strade, città) deve restare leggibile
 *  sotto; il significato lo portano i bordi e il tratteggio. Colore quasi
 *  pieno solo dove il divieto è assoluto. none resta invisibile (evita
 *  l'effetto inglobamento, decisione 2026-07-10). */
export const ZONE_FILL_OPACITY: Record<RestrictionType, number> = {
  prohibited: 0.35, auth_required: 0.07, conditional: 0.05, none: 0,
};

/** Bordi sottili e netti; gerarchia per severità. */
export const ZONE_LINE_WIDTH: Record<RestrictionType, number> = {
  prohibited: 2, auth_required: 1.2, conditional: 1, none: 0,
};

/** Sotto questa soglia di zoom le zone si mostrano FUSE per categoria (vista
 *  d'insieme: un velo e un bordo esterno per colore, niente ragnatela). */
export const ZONE_DETAIL_MINZOOM = 11;

/** Da questa soglia compaiono anche le etichette con quota standard di
 *  categoria (sotto: solo le eccezioni — la quota tipica sta in legenda). */
export const ZONE_LABEL_ALL_MINZOOM = 13;

export const ITALY_CENTER: [number, number] = [12.5, 42.0];
export const ITALY_ZOOM = 5;

/** Opacità del tratteggio "richiede autorizzazione": tenuta bassa perché la
 *  CTR di Roma/Fiumicino copre mezzo schermo — il segnale resta (velo + bordo
 *  arancione), il rumore no (feedback Lorenzo 2026-07-22). */
export const HATCH_FILL_OPACITY = 0.15;
