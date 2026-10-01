import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, TEXT_COLORS } from '../../config/display';
import type { SkillSlot } from '../../core/actions';
import { CHORD_FACE_ORDER, type InputSource } from '../../input/InputController';
import type { HotbarSlotView } from './model';
import { HUD_CENTER_X, textStyle } from './ui';

const BOX_W = 72;
const BOX_H = 50;
const GAP = 6;
const TOP = GAME_HEIGHT - 88;
const LEFT = HUD_CENTER_X - (8 * BOX_W + 7 * GAP) / 2;

const HELP = {
  keyboard: 'WASD: mover/atacar  ·  Espaço: passar  ·  1–8: hotbar  ·  I: inventário  ·  Enter: confirmar',
  gamepad: 'D-pad: mover/atacar  ·  X: passar  ·  LB/RB + A/B/X/Y: hotbar  ·  Y: inventário  ·  A: confirmar',
} as const;

/** Rótulo do slot: tecla (1–8) ou combo do controle (LB+A … RB+Y). */
export function slotLabel(slot: SkillSlot, source: InputSource): string {
  if (source === 'keyboard') return String(slot);
  const shoulder = slot <= 4 ? 'LB' : 'RB';
  return `${shoulder}+${CHORD_FACE_ORDER[(slot - 1) % 4]}`;
}

interface Box {
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly key: Phaser.GameObjects.Text;
  readonly name: Phaser.GameObjects.Text;
  readonly detail: Phaser.GameObjects.Text;
}

/** Hotbar de 8 slots embaixo do mapa + linha de ajuda dos controles. */
export class Hotbar {
  private readonly boxes: Box[] = [];
  private readonly help: Phaser.GameObjects.Text;
  private source: InputSource = 'keyboard';
  private last: readonly HotbarSlotView[] = [];

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < 8; i++) {
      const x = LEFT + i * (BOX_W + GAP);
      this.boxes.push({
        bg: scene.add.rectangle(x, TOP, BOX_W, BOX_H, 0x141414).setOrigin(0).setStrokeStyle(1, COLORS.FRAME),
        key: scene.add.text(x + 4, TOP + 3, '', textStyle(9, TEXT_COLORS.ACCENT)),
        name: scene.add.text(x + 4, TOP + 18, '', { ...textStyle(9), wordWrap: { width: BOX_W - 8 } }).setLineSpacing(1),
        detail: scene.add.text(x + BOX_W - 4, TOP + 3, '', textStyle(9, TEXT_COLORS.MUTED)).setOrigin(1, 0),
      });
    }
    this.help = scene.add.text(HUD_CENTER_X, GAME_HEIGHT - 20, '', textStyle(10, TEXT_COLORS.MUTED)).setOrigin(0.5);
    this.setSource('keyboard');
  }

  setSource(source: InputSource): void {
    this.source = source;
    this.help.setText(HELP[source]);
    this.update(this.last);
  }

  update(slots: readonly HotbarSlotView[]): void {
    this.last = slots;
    slots.forEach((s, i) => {
      const box = this.boxes[i];
      if (!box) return;
      box.key.setText(slotLabel(s.slot, this.source));
      box.name.setText(s.name);
      box.detail.setText(s.detail);
      const alpha = s.state === 'locked' || s.state === 'empty' ? 0.4 : 1;
      for (const obj of [box.key, box.name, box.detail]) obj.setAlpha(alpha);
      box.bg.setStrokeStyle(1, s.state === 'ready' ? COLORS.GOLD : COLORS.FRAME);
      box.detail.setColor(s.state === 'unusable' ? '#e05a4a' : TEXT_COLORS.MUTED);
    });
  }
}
