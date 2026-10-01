import type { LootTable } from '../items/LootTable';

/**
 * Loot por monstro (Marco 4). Equipamento com as chances do Knight da §2.4;
 * produto de criatura (só pra vender) pra todo kill render algo (§6).
 * Poções têm sorteio separado (balance.ts → POTION_DROP_CHANCE).
 */
export const LOOT_TABLES = {
  rat: [{ itemId: 'cheese', chance: 0.5 }],
  goblin: [
    { itemId: 'leatherArmor', chance: 0.3 },
    { itemId: 'woodShield', chance: 0.18 },
    { itemId: 'goblinEar', chance: 0.35 },
  ],
  skeleton: [
    { itemId: 'ironHelmet', chance: 0.25 },
    { itemId: 'bone', chance: 0.4 },
  ],
  orc: [
    { itemId: 'spikeSword', chance: 0.18 },
    { itemId: 'chainArmor', chance: 0.15 },
    { itemId: 'knightHelmet', chance: 0.1 },
    { itemId: 'towerShield', chance: 0.08 },
    { itemId: 'orcTooth', chance: 0.35 },
  ],
  // §2.2 + §2.4: Crown Helmet OU Magic Sword, sempre Tower Shield, Plate 40%, Demon Shield 25%
  orcWarlord: [
    { oneOf: ['crownHelmet', 'magicSword'], chance: 1 },
    { itemId: 'towerShield', chance: 1 },
    { itemId: 'plateArmor', chance: 0.4 },
    { itemId: 'demonShield', chance: 0.25 },
  ],
} as const satisfies Record<string, LootTable>;

export type LootTableId = keyof typeof LOOT_TABLES;
