// tests/rules/ruleTable.test.ts
import { it, expect } from 'vitest';
import { findRule, RULE_TABLE } from '../../src/rules/ruleTable';

it('ogni riga ha riferimento normativo e almeno una nota', () => {
  for (const r of RULE_TABLE) {
    expect(r.reference.length).toBeGreaterThan(0);
    expect(r.notes.length).toBeGreaterThan(0);
  }
});

it('sub-250/C0 volano in A1 anche senza attestati', () => {
  expect(findRule('sub250', [])?.subcategory).toBe('A1');
  expect(findRule('C0', [])?.subcategory).toBe('A1');
});

it('C1 richiede A1/A3', () => {
  expect(findRule('C1', ['a1a3'])?.subcategory).toBe('A1');
  expect(findRule('C1', [])).toBeNull();
});

it('C2 con A2 → A2; con solo A1/A3 → A3; senza nulla → null', () => {
  expect(findRule('C2', ['a1a3', 'a2'])?.subcategory).toBe('A2');
  expect(findRule('C2', ['a2'])?.subcategory).toBe('A2');
  expect(findRule('C2', ['a1a3'])?.subcategory).toBe('A3');
  expect(findRule('C2', [])).toBeNull();
});

it('C3, C4 e legacy ≥250g → A3 con A1/A3', () => {
  expect(findRule('C3', ['a1a3'])?.subcategory).toBe('A3');
  expect(findRule('C4', ['a1a3'])?.subcategory).toBe('A3');
  expect(findRule('legacy250plus', ['a1a3'])?.subcategory).toBe('A3');
  expect(findRule('legacy250plus', [])).toBeNull();
});
