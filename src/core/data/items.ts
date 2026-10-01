import type { ItemDef } from '../items/Item';

/**
 * Itens do MVP. Bônus e valores PROVISÓRIOS (Marco 6 balanceia).
 * DEF baixa de propósito: o risco de empilhamento da §2.12 é real.
 * Itens do boss existem desde já, mas só caem no Marco 4.
 */
export const ITEMS = {
  // Weapon
  sword: { kind: 'equipment', name: 'Sword', slot: 'weapon', atk: 3, def: 0, equipTags: ['KNIGHT'], value: 5 },
  spikeSword: { kind: 'equipment', name: 'Spike Sword', slot: 'weapon', atk: 6, def: 0, equipTags: ['KNIGHT'], value: 30 },
  magicSword: { kind: 'equipment', name: 'Magic Sword', slot: 'weapon', atk: 12, def: 0, equipTags: ['KNIGHT'], value: 200 },
  // Armor
  leatherArmor: { kind: 'equipment', name: 'Leather Armor', slot: 'armor', atk: 0, def: 1, equipTags: ['ALL'], value: 8 },
  chainArmor: { kind: 'equipment', name: 'Chain Armor', slot: 'armor', atk: 0, def: 2, equipTags: ['KNIGHT'], value: 25 },
  plateArmor: { kind: 'equipment', name: 'Plate Armor', slot: 'armor', atk: 0, def: 4, equipTags: ['KNIGHT'], value: 120 },
  // Helmet
  ironHelmet: { kind: 'equipment', name: 'Iron Helmet', slot: 'helmet', atk: 0, def: 1, equipTags: ['KNIGHT'], value: 10 },
  knightHelmet: { kind: 'equipment', name: 'Knight Helmet', slot: 'helmet', atk: 0, def: 2, equipTags: ['KNIGHT'], value: 35 },
  crownHelmet: { kind: 'equipment', name: 'Crown Helmet', slot: 'helmet', atk: 0, def: 3, equipTags: ['KNIGHT'], value: 150 },
  // Shield
  woodShield: { kind: 'equipment', name: 'Wood Shield', slot: 'shield', atk: 0, def: 1, equipTags: ['KNIGHT'], value: 6 },
  towerShield: { kind: 'equipment', name: 'Tower Shield', slot: 'shield', atk: 0, def: 2, equipTags: ['KNIGHT'], value: 50 },
  demonShield: { kind: 'equipment', name: 'Demon Shield', slot: 'shield', atk: 0, def: 4, equipTags: ['KNIGHT'], value: 180 },
  // Poções
  hpPotion: { kind: 'potion', name: 'Health Potion', effect: { type: 'heal', pct: 0.5 }, value: 10 },
  manaPotion: { kind: 'potion', name: 'Mana Potion', effect: { type: 'mana', pct: 0.5 }, value: 8 },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

export function getItem(id: ItemId): ItemDef {
  return ITEMS[id];
}
