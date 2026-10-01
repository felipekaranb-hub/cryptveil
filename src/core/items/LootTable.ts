import type { ItemId } from '../data/items';
import type { Rng } from '../rng';

export interface LootEntry {
  readonly itemId: ItemId;
  /** 0..1. Cada linha é sorteada sozinha: um kill pode render mais de um item. */
  readonly chance: number;
}

export type LootTable = readonly LootEntry[];

export function rollLoot(table: LootTable, rng: Rng): ItemId[] {
  return table.filter((entry) => rng.chance(entry.chance)).map((entry) => entry.itemId);
}
