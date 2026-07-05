import circle from '@turf/circle';
import type { Polygon, MultiPolygon } from 'geojson';
import type { Ed269Document, Ed269Feature, Ed269Volume, Zone, RestrictionType } from './ed269.types';

const RESTRICTION: Record<string, RestrictionType> = {
  PROHIBITED: 'prohibited',
  REQ_AUTHORISATION: 'auth_required',
  CONDITIONAL: 'conditional',
  NO_RESTRICTION: 'none',
};

function toMeters(v: number | undefined, uom?: string): number | null {
  if (v == null) return null;
  return uom === 'FT' ? Math.round(v * 0.3048) : v;
}

function geometryOf(vol: Ed269Volume | undefined, uom?: string): Polygon | MultiPolygon | null {
  const hp = vol?.horizontalProjection;
  if (!hp) return null;
  if (hp.type === 'Polygon') return { type: 'Polygon', coordinates: hp.coordinates };
  if (hp.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: hp.coordinates };
  if (hp.type === 'Circle' && Array.isArray(hp.center) && typeof hp.radius === 'number') {
    const radiusKm = (uom === 'FT' ? hp.radius * 0.3048 : hp.radius) / 1000;
    return circle(hp.center, radiusKm, { steps: 48, units: 'kilometers' }).geometry as Polygon;
  }
  return null;
}

function dateOf(iso: unknown): string | null {
  return typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : null;
}

function applicabilityTextOf(applic: any, permanent: boolean): string | null {
  if (permanent) return null;
  const parts: string[] = [];
  const from = dateOf(applic?.startDateTime), to = dateOf(applic?.endDateTime);
  if (from || to) parts.push([from, to].filter(Boolean).join(' → '));
  const sched = Array.isArray(applic?.schedule) ? applic.schedule : [];
  for (const s of sched) {
    const days = Array.isArray(s?.day) ? s.day.join(', ') : '';
    const hours = s?.startTime && s?.endTime ? `${s.startTime}–${s.endTime}` : '';
    const t = [days, hours].filter(Boolean).join(' ');
    if (t) parts.push(t);
  }
  return parts.length ? parts.join(' · ') : 'a orari/finestre — verifica su D-Flight';
}

function authorityOf(f: Ed269Feature) {
  const a = Array.isArray(f.zoneAuthority) ? f.zoneAuthority[0] : f.zoneAuthority;
  if (!a) return null;
  return { name: a.name, email: a.email, phone: a.phone };
}

export function normalizeZones(doc: Ed269Document): Zone[] {
  const zones: Zone[] = [];
  doc.features.forEach((f, i) => {
    const vol = f.geometry?.[0];
    const geometry = geometryOf(vol, vol?.uomDimensions);
    if (!geometry) return; // scarta feature senza geometria utilizzabile
    const applic = Array.isArray(f.applicability) ? f.applicability[0] : undefined;
    const permanent = applic?.permanent === 'YES' || applic?.permanent === true || !applic;
    zones.push({
      id: f.identifier || `zone-${i}`,
      name: f.name || 'Zona senza nome',
      restrictionType: RESTRICTION[(f.restriction || '').toUpperCase()] ?? 'conditional',
      geometry,
      lowerLimitM: toMeters(vol?.lowerLimit, vol?.uomDimensions),
      upperLimitM: toMeters(vol?.upperLimit, vol?.uomDimensions),
      verticalRef: (vol?.upperVerticalReference as Zone['verticalRef']) ?? null,
      message: f.message ?? null,
      reasons: Array.isArray(f.reason) ? f.reason : [],
      authority: authorityOf(f),
      permanent,
      applicabilityText: applicabilityTextOf(applic, permanent),
    });
  });
  return zones;
}
