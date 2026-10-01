import type { LootTable } from '../items/LootTable';

/** Chances do Knight por monstro (handoff §2.4). Tabelas completas no Marco 4. */
const GOBLIN = [
  { itemId: 'leatherArmor', chance: 0.3 },
  { itemId: 'woodShield', chance: 0.18 },
] as const satisfies LootTable;

const SKELETON = [{ itemId: 'ironHelmet', chance: 0.25 }] as const satisfies LootTable;

const ORC = [
  { itemId: 'spikeSword', chance: 0.18 },
  { itemId: 'chainArmor', chance: 0.15 },
  { itemId: 'knightHelmet', chance: 0.1 },
  { itemId: 'towerShield', chance: 0.08 },
] as const satisfies LootTable;

export const LOOT_TABLES = {
  goblin: GOBLIN,
  skeleton: SKELETON,
  orc: ORC,
  /**
   * PROVISÓRIO (Marco 2): o Goblin dummy de cada andar usa as tabelas dos
   * monstros que o Marco 4 vai colocar ali. Andar 1 Goblin, 2 Goblin+Skeleton,
   * 3+ Skeleton+Orc.
   */
  placeholderFloor1: GOBLIN,
  placeholderFloor2: [...GOBLIN, ...SKELETON],
  placeholderFloor3: [...SKELETON, ...ORC],
} as const satisfies Record<string, LootTable>;

export type LootTableId = keyof typeof LOOT_TABLES;
