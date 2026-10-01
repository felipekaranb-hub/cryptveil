/**
 * Constantes de tela e visual. Pertence à camada de view (Phaser),
 * não ao core — o core nunca pensa em pixel.
 */

/** Tamanho do tile na tela (handoff §2.11 — não revisitar no MVP). */
export const TILE_SIZE = 32;

/** Área visível do mapa, em tiles. */
export const VIEWPORT_W = 15;
export const VIEWPORT_H = 11;

/**
 * Resolução base 16:9. Escala inteira exata pra 1080p (2×) e 4K (4×),
 * então o pixel art nunca fica com pixels de tamanhos diferentes.
 */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Retângulo onde a câmera do mapa desenha (480×352), centralizado. */
export const MAP_VIEW = {
  width: VIEWPORT_W * TILE_SIZE,
  height: VIEWPORT_H * TILE_SIZE,
  x: (GAME_WIDTH - VIEWPORT_W * TILE_SIZE) / 2,
  y: (GAME_HEIGHT - VIEWPORT_H * TILE_SIZE) / 2,
} as const;

export const COLORS = {
  BACKGROUND: 0x0a0a0a,
  BLOOD_RED: 0x8b1818,
  MANA_BLUE: 0x1e5fb5,
  POISON_GREEN: 0x4a7a2a,
  STONE_GRAY: 0x4a4a4a,
  WOOD_BROWN: 0x6b4423,
  GOLD: 0xc9a55c,
  FRAME: 0x2a2a2a,
  HIGHLIGHT: 0xc9a55c,
  HP_GREEN: 0x4caf50,
  HP_YELLOW: 0xd4a72c,
  HP_RED: 0xc0392b,
  /** Pedra, lança, facas (Marco 4). */
  PROJECTILE: 0xd8d0b8,
  /** Corpo do boss (até os sprites do Marco 6) e do boss enfurecido. */
  BOSS: 0x7a3a8a,
  BOSS_ENRAGED: 0xc0392b,
} as const;

export const TILE_COLORS = {
  FLOOR_LIGHT: 0x3a3a3a,
  FLOOR_DARK: 0x343434,
  WALL: 0x1a1a1a,
  WALL_EDGE: 0x262626,
  STAIRS: 0x6b4423,
  STAIRS_STEP: 0xc9a55c,
  TRAINING: 0x3b2a55,
  TRAINING_MARK: 0xc9a55c,
  MERCHANT: 0x4a3418,
  MERCHANT_COIN: 0xe0b84a,
} as const;

export const TEXT_COLORS = {
  ACCENT: '#c9a55c',
  PRIMARY: '#e8e2d4',
  MUTED: '#8a8578',
} as const;

/** Cores dos números flutuantes. */
export const POP_COLORS = {
  DAMAGE_DEALT: '#f4ecd8',
  DAMAGE_TAKEN: '#e05a4a',
  HEAL: '#6fcf6f',
  MANA: '#6fa8e8',
} as const;

export const FONT_FAMILY = 'monospace';

export const SCENE_KEYS = {
  BOOT: 'boot',
  GAME: 'game',
  UI: 'ui',
} as const;

/** Cor de cada tom do LOG (view/format.ts → LogTone). */
export const LOG_TONE_COLORS = {
  normal: '#e8e2d4',
  muted: '#8a8578',
  danger: '#e05a4a',
  good: '#6fcf6f',
  mana: '#6fa8e8',
  loot: '#c9a55c',
  level: '#d9b8ff',
} as const;

/** Fog of war no mapa: o que nunca foi visto some; o explorado fora de vista escurece. */
export const FOG = {
  UNSEEN: 0x0a0a0a,
  REMEMBERED_ALPHA: 0.55,
} as const;

export const MINIMAP_COLORS = {
  FLOOR: 0x5a5a5a,
  WALL: 0x262626,
  STAIRS: 0xc9a55c,
  TRAINING: 0x8a5ec9,
  PLAYER: 0xe04040,
  ENEMY: 0x7fd15a,
  MERCHANT: 0xe0b84a,
} as const;
