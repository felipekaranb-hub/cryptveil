import type { Point } from '../core/grid';
import { TILE_SIZE } from '../config/display';

/**
 * Conversão tile ↔ pixel no espaço do MUNDO (não da tela).
 * A câmera cuida de levar o mundo pra tela; por isso nada de offset aqui.
 */

/** Centro do tile em pixels do mundo. */
export function tileToWorld(p: Point): Point {
  return {
    x: p.x * TILE_SIZE + TILE_SIZE / 2,
    y: p.y * TILE_SIZE + TILE_SIZE / 2,
  };
}

/** Tile que contém o ponto do mundo. */
export function worldToTile(worldX: number, worldY: number): Point {
  return {
    x: Math.floor(worldX / TILE_SIZE),
    y: Math.floor(worldY / TILE_SIZE),
  };
}
