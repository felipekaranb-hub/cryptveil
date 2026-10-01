/**
 * RNG determinístico com seed (algoritmo sfc32).
 *
 * Por que não Math.random(): com seed, um bug vira "seed 48213, andar 3"
 * e dá pra reproduzir. Também é a base de uma futura run diária.
 *
 * Regra do projeto: NADA no core/ chama Math.random(). Tudo passa por um Rng.
 * O estado é serializável (getState/fromState), então entra no save da run.
 */

export type RngState = readonly [number, number, number, number];

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  private constructor(state: RngState) {
    [this.a, this.b, this.c, this.d] = state;
  }

  /** Cria a partir de um seed numérico ou texto ("cryptveil", "48213"...). */
  static fromSeed(seed: number | string): Rng {
    const s = typeof seed === 'number' ? String(seed) : seed;
    // Espalha o seed em 4 palavras de 32 bits (cyrb128)
    let h1 = 1779033703;
    let h2 = 3144134277;
    let h3 = 1013904242;
    let h4 = 2773480762;
    for (let i = 0; i < s.length; i++) {
      const k = s.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    const rng = new Rng([
      (h1 ^ h2 ^ h3 ^ h4) >>> 0,
      (h2 ^ h1) >>> 0,
      (h3 ^ h1) >>> 0,
      (h4 ^ h1) >>> 0,
    ]);
    // Descarta os primeiros valores pra misturar bem o estado inicial
    for (let i = 0; i < 12; i++) rng.nextUint32();
    return rng;
  }

  static fromState(state: RngState): Rng {
    return new Rng(state);
  }

  getState(): RngState {
    return [this.a, this.b, this.c, this.d];
  }

  /** Inteiro sem sinal de 32 bits. */
  nextUint32(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Float em [0, 1). */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Inteiro em [min, max], os dois inclusos. */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error(`Rng.int espera inteiros, recebeu ${min}..${max}`);
    }
    if (max < min) throw new Error(`Rng.int: max (${max}) < min (${min})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** true com probabilidade p (0..1). Ex.: chance(0.18) pra drop de 18%. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: lista vazia');
    return items[this.int(0, items.length - 1)] as T;
  }
}

/** Seed novo pra uma run: número curto, fácil de anotar num bug report. */
export function randomSeed(): number {
  // Único Math.random() permitido: escolher o seed, fora da simulação
  return Math.floor(Math.random() * 1_000_000);
}
