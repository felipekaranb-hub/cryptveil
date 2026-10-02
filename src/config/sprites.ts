/**
 * Sprites (Marco 6b): Tiny Dungeon + Tiny Town (Kenney, CC0) e sprites
 * próprios no mesmo estilo, num atlas só (`tools/sprites/build_atlas.py`).
 * Tiles de 16 px desenhados a 2× no tile de 32. Visual da view, não regra.
 */
import type { ItemId } from '../core/data/items';
import type { RelicId } from '../core/data/relics';
import { TILE_SIZE } from './display';

export const ATLAS = {
  key: 'atlas',
  url: 'assets/sprites/atlas.png',
  frame: 16,
} as const;

/** Escala do sprite de 16 px pro tile de 32. */
export const SPRITE_SCALE = TILE_SIZE / ATLAS.frame;

/** Frame no atlas: Tiny Dungeon 0–131 · Tiny Town 132–263 · próprios 264+. */
const OWN = 264;

/** Entidade → frame (pelo nome do template; monstro novo sem sprite cai no FALLBACK). */
export const ENTITY_FRAMES: Readonly<Record<string, number>> = {
  Knight: 97,
  // Desenhados no estilo do pack (o Rat 124 era visto de cima e não lia; o Goblin 112 ganhou pele verde)
  Rat: OWN + 3,
  Goblin: OWN + 4,
  Skeleton: OWN + 0,
  Orc: OWN + 1,
  'Orc Warlord': OWN + 2,
};
export const ENTITY_FALLBACK_FRAME = 121; // fantasma do pack

/** Boss um pouco maior que o tile, pra ler como chefe. */
export const BOSS_SCALE = 1.25;

export const TILE_FRAMES = {
  /** Chão: variações sorteadas por posição (estável entre redesenhos). */
  floor: [48, 48, 48, 48, 48, 48, 48, 48, 48, 49, 48, 48, 48, 51],
  /** Parede com chão logo abaixo: a face de tijolo. */
  wallFace: 40,
  /** Resto da parede que encosta em chão: o topo escuro. */
  wallTop: 0,
  stairs: 39,
  training: 64,
  merchant: 90,
} as const;

/** Ícone do item (inventário, loja, paper doll). Todo item do MVP tem; item novo sem ícone → sigla. */
export const ITEM_FRAMES: Readonly<Partial<Record<ItemId, number>>> = {
  sword: 104,
  spikeSword: 105,
  magicSword: OWN + 13,
  leatherArmor: OWN + 5,
  chainArmor: OWN + 6,
  plateArmor: OWN + 7,
  ironHelmet: OWN + 8,
  knightHelmet: OWN + 9,
  crownHelmet: OWN + 10,
  woodShield: 101,
  towerShield: OWN + 11,
  demonShield: OWN + 12,
  hpPotion: 115,
  manaPotion: 116,
  cheese: OWN + 14,
  goblinEar: OWN + 15,
  bone: OWN + 16,
  orcTooth: OWN + 17,
};

/** Ícone de cada relíquia. */
export const RELIC_FRAMES: Readonly<Record<RelicId, number>> = {
  goldenIdol: OWN + 18,
  watcherEye: OWN + 19,
  bloodStone: OWN + 20,
  warTotem: OWN + 21,
};

/**
 * Escurecer "mas não muito" (decisão do Felipe): o Tiny Dungeon é claro e
 * alegre, a cripta é escura. Tint multiplicativo, por camada.
 */
export const SPRITE_TINTS = {
  floor: 0xa89c94,
  wall: 0xa49a96,
  object: 0xd6ccc4,
  entity: 0xf2ebe4,
  /** Borda de pedra no topo das paredes (desenhada em código). */
  wallRim: 0x8b9bb4,
  /** Boss enfurecido (multiplica o sprite). */
  enraged: 0xff7070,
} as const;
