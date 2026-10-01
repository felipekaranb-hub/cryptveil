/**
 * Relíquias (Marco 4): 3 slots, vendidas pelo mercador (uma por visita).
 * Efeitos diferentes das cartas de propósito — nada de "+X de dano" puro.
 * Números provisórios (Marco 6 balanceia).
 */
export type RelicEffect =
  /** Gold por kill × (1 + pct). */
  | { readonly type: 'gold-pct'; readonly pct: number }
  /** Visão no corredor vira `vision` e a escada aparece no minimapa ao chegar no andar. */
  | { readonly type: 'watcher'; readonly vision: number }
  /** Cada kill cura essa fração do HP max. */
  | { readonly type: 'kill-heal-pct'; readonly pct: number }
  /** Primeiro golpe do player em cada monstro dá dano × multiplier. */
  | { readonly type: 'first-strike'; readonly multiplier: number };

export interface RelicDef {
  readonly name: string;
  readonly description: string;
  /** Preço no mercador. */
  readonly price: number;
  readonly effect: RelicEffect;
}

export const RELICS = {
  goldenIdol: {
    name: 'Ídolo Dourado',
    description: '+50% de gold por kill',
    price: 55,
    effect: { type: 'gold-pct', pct: 0.5 },
  },
  watcherEye: {
    name: 'Olho do Vigia',
    description: 'Visão 4 no corredor; a escada aparece no minimapa',
    price: 45,
    effect: { type: 'watcher', vision: 4 },
  },
  bloodStone: {
    name: 'Pedra de Sangue',
    description: 'Cada kill cura 5% do HP máximo',
    price: 75,
    effect: { type: 'kill-heal-pct', pct: 0.05 },
  },
  warTotem: {
    name: 'Totem de Guerra',
    description: 'Primeiro golpe em cada monstro dá dano ×2',
    price: 85,
    effect: { type: 'first-strike', multiplier: 2 },
  },
} as const satisfies Record<string, RelicDef>;

export type RelicId = keyof typeof RELICS;

export const RELIC_IDS = Object.keys(RELICS) as RelicId[];
