import Phaser from 'phaser';
import { LOG_TONE_COLORS, TEXT_COLORS } from '../../config/display';
import type { LogLine } from '../format';
import { getRenderScale } from '../scaling';
import { PANEL_W, RIGHT_X, textStyle } from './ui';

const MAX_LINES = 30;
const LINE_GAP = 3;

/**
 * LOG de combate: uma linha por evento do core, colorida pelo tom
 * (dano levado em vermelho, loot dourado, nível em lilás…). As mais novas
 * ficam embaixo; as velhas saem por cima quando não cabem.
 */
export class BattleLog {
  private lines: LogLine[] = [];
  private texts: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly top: number,
    private readonly bottom: number,
  ) {
    scene.add.text(RIGHT_X + 12, top, 'LOG', textStyle(11, TEXT_COLORS.ACCENT));
  }

  push(lines: readonly LogLine[]): void {
    this.lines.push(...lines);
    if (this.lines.length > MAX_LINES) this.lines.splice(0, this.lines.length - MAX_LINES);
    this.render();
  }

  clear(): void {
    this.lines = [];
    this.render();
  }

  private render(): void {
    for (const t of this.texts) t.destroy();
    this.texts = [];
    // De baixo pra cima: a mais nova encosta no fundo, as que não cabem somem
    let y = this.bottom;
    const scale = getRenderScale();
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const line = this.lines[i]!;
      const text = this.scene.add
        .text(RIGHT_X + 12, 0, line.text, { ...textStyle(10, LOG_TONE_COLORS[line.tone]), wordWrap: { width: PANEL_W - 24 } })
        .setResolution(scale);
      y -= text.height;
      if (y < this.top + 18) {
        text.destroy();
        break;
      }
      text.setY(y);
      y -= LINE_GAP;
      this.texts.push(text);
    }
  }
}
