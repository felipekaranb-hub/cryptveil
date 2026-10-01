import Phaser from 'phaser';
import { MINIMAP_COLORS, TEXT_COLORS } from '../../config/display';
import { MiniCell, type MinimapView } from './model';
import { PANEL_W, RIGHT_X, textStyle } from './ui';

const BOX_W = PANEL_W - 24;
const BOX_H = 128;

const CELL_COLORS: Readonly<Record<Exclude<MiniCell, 0>, number>> = {
  [MiniCell.FLOOR]: MINIMAP_COLORS.FLOOR,
  [MiniCell.WALL]: MINIMAP_COLORS.WALL,
  [MiniCell.STAIRS]: MINIMAP_COLORS.STAIRS,
  [MiniCell.TRAINING]: MINIMAP_COLORS.TRAINING,
};

/** Minimapa do andar: só o explorado (fog of war), player e monstros à vista. */
export class MiniMap {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly left = RIGHT_X + 12;

  constructor(
    scene: Phaser.Scene,
    private readonly top: number,
  ) {
    scene.add.text(this.left, top, 'MAPA', textStyle(11, TEXT_COLORS.ACCENT));
    scene.add.rectangle(this.left, top + 16, BOX_W, BOX_H, 0x0a0a0a).setOrigin(0);
    this.g = scene.add.graphics();
  }

  /** Altura total ocupada (título + mapa). */
  static get height(): number {
    return 16 + BOX_H;
  }

  update(view: MinimapView): void {
    const cell = Math.max(1, Math.floor(Math.min(BOX_W / view.width, BOX_H / view.height)));
    const ox = this.left + Math.floor((BOX_W - cell * view.width) / 2);
    const oy = this.top + 16 + Math.floor((BOX_H - cell * view.height) / 2);
    const g = this.g;
    g.clear();
    view.cells.forEach((c, i) => {
      if (c === MiniCell.UNKNOWN) return;
      g.fillStyle(CELL_COLORS[c], 1);
      g.fillRect(ox + (i % view.width) * cell, oy + Math.floor(i / view.width) * cell, cell, cell);
    });
    g.fillStyle(MINIMAP_COLORS.ENEMY, 1);
    for (const e of view.enemies) g.fillRect(ox + e.x * cell, oy + e.y * cell, cell, cell);
    // Player um pouco maior pra achar de relance
    g.fillStyle(MINIMAP_COLORS.PLAYER, 1);
    g.fillRect(ox + view.player.x * cell - 1, oy + view.player.y * cell - 1, cell + 2, cell + 2);
  }
}
