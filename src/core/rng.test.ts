import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
  it('mesmo seed → mesma sequência', () => {
    const a = Rng.fromSeed(48213);
    const b = Rng.fromSeed(48213);
    for (let i = 0; i < 100; i++) expect(a.nextUint32()).toBe(b.nextUint32());
  });

  it('seeds diferentes → sequências diferentes', () => {
    const a = Rng.fromSeed(1);
    const b = Rng.fromSeed(2);
    const seqA = Array.from({ length: 10 }, () => a.nextUint32());
    const seqB = Array.from({ length: 10 }, () => b.nextUint32());
    expect(seqA).not.toEqual(seqB);
  });

  it('estado salvo retoma exatamente de onde parou (base do save de run)', () => {
    const rng = Rng.fromSeed('cryptveil');
    for (let i = 0; i < 37; i++) rng.next();
    const saved = JSON.parse(JSON.stringify(rng.getState()));
    const restored = Rng.fromState(saved);
    for (let i = 0; i < 50; i++) expect(restored.nextUint32()).toBe(rng.nextUint32());
  });

  it('int fica dentro da faixa e cobre os extremos', () => {
    const rng = Rng.fromSeed(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('chance se aproxima da probabilidade pedida', () => {
    const rng = Rng.fromSeed(99);
    let hits = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (rng.chance(0.18)) hits++;
    expect(hits / n).toBeGreaterThan(0.16);
    expect(hits / n).toBeLessThan(0.2);
  });

  it('rejeita faixas inválidas', () => {
    const rng = Rng.fromSeed(1);
    expect(() => rng.int(5, 2)).toThrow();
    expect(() => rng.int(1.5, 3)).toThrow();
    expect(() => rng.pick([])).toThrow();
  });
});
