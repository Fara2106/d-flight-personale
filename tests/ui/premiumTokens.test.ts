// tests/ui/premiumTokens.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../src/index.css'), 'utf8');

describe('token UI premium (vetro stile iOS)', () => {
  it('definisce i token vetro in entrambi i temi', () => {
    expect(css).toMatch(/:root\s*{[^}]*--glass-bg:/);
    expect(css).toMatch(/\[data-theme='dark'\]\s*{[^}]*--glass-bg:/);
    expect(css).toMatch(/--shadow-sm:/);
    expect(css).toMatch(/--shadow-lg:/);
    expect(css).toMatch(/--radius-card:/);
  });
  it('.glass usa il blur con fallback per browser senza supporto', () => {
    expect(css).toMatch(/\.glass\b[^{]*{[^}]*backdrop-filter/);
    expect(css).toMatch(/@supports not/);
  });
  it('le micro-transizioni rispettano prefers-reduced-motion', () => {
    expect(css).toMatch(/prefers-reduced-motion/);
  });
});
