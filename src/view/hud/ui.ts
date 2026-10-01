import type Phaser from 'phaser';
import { FONT_FAMILY, GAME_WIDTH, MAP_VIEW, TEXT_COLORS } from '../../config/display';

/**
 * Layout comum do HUD (coordenadas lógicas 960×540).
 * Painel esquerdo = Knight · direito = minimapa + LOG · embaixo = hotbar.
 */
export const PANEL_W = MAP_VIEW.x - 32;
export const LEFT_X = 16;
export const RIGHT_X = MAP_VIEW.x + MAP_VIEW.width + 16;
export const PANEL_TOP = MAP_VIEW.y;
export const PANEL_H = MAP_VIEW.height;
export const HUD_CENTER_X = GAME_WIDTH / 2;

export function textStyle(size: number, color: string = TEXT_COLORS.PRIMARY): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color };
}

/** Cor 0xRRGGBB → '#rrggbb' (texto do Phaser usa string). */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
