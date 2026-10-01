import type { ItemId } from '../data/items';
import type { Rng } from '../rng';

/**
 * Linha da tabela. `chance` 0..1, cada linha sorteada sozinha (um kill pode
 * render mais de um item). `oneOf`: se a linha sair, cai UM dos itens (boss:
 * Crown Helmet OU Magic Sword, §2.2).
 */
export type LootEntry =
  | { readonly itemId: ItemId; readonly chance: number }
  | { readonly oneOf: readonly ItemId[]; readonly chance: number };

export type LootTable = readonly LootEntry[];

export function rollLoot(table: LootTable, rng: Rng): ItemId[] {
  const drops: ItemId[] = [];
  for (const entry of table) {
    if (!rng.chance(entry.chance)) continue;
    drops.push('oneOf' in entry ? rng.pick(entry.oneOf) : entry.itemId);
  }
  return drops;
}
