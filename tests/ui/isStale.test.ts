import { describe, it, expect } from 'vitest';
import { isStale } from '../../src/ui/isStale';

describe('isStale', () => {
  it('is stale when older than the AIRAC window', () => {
    expect(isStale('2026-05-01', new Date('2026-06-30'))).toBe(true);
  });
  it('is fresh within the window', () => {
    expect(isStale('2026-06-20', new Date('2026-06-30'))).toBe(false);
  });
  it('is stale when there is no cycle date (unknown)', () => {
    expect(isStale(null, new Date('2026-06-30'))).toBe(true);
  });
});
