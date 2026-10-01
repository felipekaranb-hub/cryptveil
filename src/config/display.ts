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
} as const;

export const TILE_COLORS = {
  FLOOR_LIGHT: 0x3a3a3a,
  FLOOR_DARK: 0x343434,
  WALL: 0x1a1a1a,
  WALL_EDGE: 0x262626,
  STAIRS: 0x6b4423,
  STAIRS_STEP: 0xc9a55c,
} as const;

export const TEXT_COLORS = {
  ACCENT: '#c9a55c',
  PRIMARY: '#e8e2d4',
  MUTED: '#8a8578',
} as const;

export const FONT_FAMILY = 'monospace';

export const SCENE_KEYS = {
  BOOT: 'boot',
  GAME: 'game',
  UI: 'ui',
} as const;
