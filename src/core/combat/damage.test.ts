import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { damageRange, rollDamage } from './damage';

describe('dano', () => {
  it('faixa do Knight (ATK 10) é 8–13', () => {
    expect(damageRange(10)).toEqual({ min: 8, max: 13 });
  });

  it('Orc Warlord com ATK 24 cai na faixa 18–30 do handoff', () => {
    expect(damageRange(24)).toEqual({ min: 18, max: 30 });
  });

  it('nunca dá menos que 1, mesmo com DEF enorme', () => {
    const rng = Rng.fromSeed(1);
    for (let i = 0; i < 500; i++) expect(rollDamage(3, 50, rng)).toBe(1);
  });

  it('Knight (ATK 10) contra Goblin dummy (DEF 1) → 7 a 12', () => {
    const rng = Rng.fromSeed(2);
    for (let i = 0; i < 1000; i++) {
      const d = rollDamage(10, 1, rng);
      expect(d).toBeGreaterThanOrEqual(7);
      expect(d).toBeLessThanOrEqual(12);
    }
  });

  it('é determinístico com o mesmo seed', () => {
    const a = Rng.fromSeed(123);
    const b = Rng.fromSeed(123);
    for (let i = 0; i < 100; i++) expect(rollDamage(15, 4, a)).toBe(rollDamage(15, 4, b));
  });
});
