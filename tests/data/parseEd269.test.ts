import { describe, it, expect } from 'vitest';
import { parseEd269, Ed269ParseError } from '../../src/data/parseEd269';

const valid = JSON.stringify({
  features: [{
    identifier: 'ITA-001', name: 'CTR Roma', restriction: 'PROHIBITED',
    geometry: [{ horizontalProjection: { type: 'Polygon',
      coordinates: [[[12.5,41.8],[12.6,41.8],[12.6,41.9],[12.5,41.8]]] },
      lowerLimit: 0, upperLimit: 0, uomDimensions: 'M' }],
  }],
});

it('parses a valid ED-269 document (string)', () => {
  const doc = parseEd269(valid);
  expect(doc.features).toHaveLength(1);
  expect(doc.features[0].name).toBe('CTR Roma');
});
it('parses an already-parsed object', () => {
  expect(parseEd269(JSON.parse(valid)).features).toHaveLength(1);
});
it('throws on invalid JSON', () => {
  expect(() => parseEd269('{not json')).toThrow(Ed269ParseError);
});
it('throws when features array is missing', () => {
  expect(() => parseEd269('{"foo":1}')).toThrow(Ed269ParseError);
});
