import { META } from '../balance';

/**
 * Sanctum (Marco 5): os 3 prédios da meta-progressão e os upgrades de cada
 * um. Preços e efeitos em balance.ts (META); aqui só nome e texto.
 * Shrine of Vocations fica pós-MVP (só existe o Knight).
 */
export type BuildingId = 'vault' | 'armory' | 'tome';

export interface UpgradeDef {
  readonly building: BuildingId;
  readonly name: string;
  /** O que cada nível dá (índice 0 = nível 1). */
  readonly levels: readonly string[];
  readonly costs: readonly number[];
}

const pct = (n: number): string => `${Math.round(n * 100)}%`;

export const UPGRADES = {
  vault: {
    building: 'vault',
    name: 'Cofre',
    levels: META.deathConversion.slice(1).map((r) => `Morte converte ${pct(r)} do gold`),
    costs: META.costs.vault,
  },
  sharpen: {
    building: 'armory',
    name: 'Afiar',
    levels: [1, 2, 3].map((n) => `+${n * META.sharpenAtk} ATK no início da run`),
    costs: META.costs.sharpen,
  },
  reinforce: {
    building: 'armory',
    name: 'Reforçar',
    levels: [1, 2, 3].map((n) => `+${n * META.reinforceHp} HP max no início da run`),
    costs: META.costs.reinforce,
  },
  wisdom: {
    building: 'tome',
    name: 'Saber',
    levels: [
      '1ª escolha de carta com 4 opções',
      'Começa a run com 1 carta escolhida',
      `+${pct(META.wisdomXpPct)} de XP por kill`,
    ],
    costs: META.costs.wisdom,
  },
  reread: {
    building: 'tome',
    name: 'Releitura',
    levels: [1, 2, 3].map((n) => `Rerrola a escolha de carta ${n}× por run`),
    costs: META.costs.reread,
  },
} as const satisfies Record<string, UpgradeDef>;

export type UpgradeId = keyof typeof UPGRADES;

export const BUILDINGS = {
  vault: { name: 'The Vault', blurb: 'Guarda mais do seu gold quando você morre.' },
  armory: { name: 'Ancient Armory', blurb: 'O Knight já desce mais forte.' },
  tome: { name: 'Tome of Knowledge', blurb: 'Mais escolhas e mais XP nas cartas.' },
} as const satisfies Record<BuildingId, { name: string; blurb: string }>;

export function upgradesOf(building: BuildingId): UpgradeId[] {
  return (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => UPGRADES[id].building === building);
}

export function maxUpgradeLevel(id: UpgradeId): number {
  return UPGRADES[id].costs.length;
}

/**
 * Bestiário básico (decisão do Felipe, opção A): os monstros da Região 1,
 * na ordem em que aparecem. Stats só aparecem depois da 1ª kill.
 */
export const BESTIARY = ['rat', 'goblin', 'skeleton', 'orc', 'orcWarlord'] as const;
export type SpeciesId = (typeof BESTIARY)[number];
