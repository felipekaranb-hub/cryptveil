import type { ItemId } from './items';

/**
 * Equipamentos que o mercador pode ter, pelo andar (Marco 4). Do nível dos
 * monstros que moram ali; itens do boss nunca. Poções estão sempre à venda.
 */
export const SHOP_EQUIPMENT_POOLS: readonly { readonly fromFloor: number; readonly items: readonly ItemId[] }[] = [
  { fromFloor: 1, items: ['leatherArmor', 'woodShield', 'ironHelmet', 'spikeSword', 'chainArmor'] },
  { fromFloor: 3, items: ['spikeSword', 'chainArmor', 'knightHelmet', 'towerShield', 'ironHelmet'] },
];

/** Sempre à venda, sem limite. */
export const SHOP_POTIONS: readonly ItemId[] = ['hpPotion', 'manaPotion'];
