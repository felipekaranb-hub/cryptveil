import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { damageRange, mitigate, rollDamage } from './damage';

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

  it('Knight (ATK 10) contra Goblin (DEF 1) → 8–13 × 20/21 → 8 a 12', () => {
    const rng = Rng.fromSeed(2);
    for (let i = 0; i < 1000; i++) {
      const d = rollDamage(10, 1, rng);
      expect(d).toBeGreaterThanOrEqual(8);
      expect(d).toBeLessThanOrEqual(12);
    }
  });

  it('DEF reduz em porcentagem (K = 20): DEF 0 não reduz, DEF 20 corta metade', () => {
    expect(mitigate(30, 0)).toBe(30);
    expect(mitigate(30, 20)).toBe(15);
    expect(mitigate(14, 15)).toBe(8); // Skeleton no topo da faixa contra DEF 15: era 1 na fórmula antiga
  });

  it('DEF alta segura muito, mas golpe forte ainda passa', () => {
    expect(mitigate(30, 100)).toBe(5);
    expect(mitigate(2, 100)).toBe(1);
  });

  it('é determinístico com o mesmo seed', () => {
    const a = Rng.fromSeed(123);
    const b = Rng.fromSeed(123);
    for (let i = 0; i < 100; i++) expect(rollDamage(15, 4, a)).toBe(rollDamage(15, 4, b));
  });
});
