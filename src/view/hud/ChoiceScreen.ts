import Phaser from 'phaser';
import { COLORS, MAP_VIEW, TEXT_COLORS } from '../../config/display';
import type { ChoiceOption, GameEvents } from '../events';
import { getRenderScale } from '../scaling';
import { cssColor, textStyle } from './ui';

const CARD_W = 140;
const CARD_H = 190;
/** Cor da borda por raridade (epic = roxo, a mais rara). */
const RARITY_COLORS = { common: 0x8a8578, rare: 0x3d7fd1, epic: 0xa45ee5, training: 0xc9a55c } as const;

/**
 * Tela de escolha (cartas do level up / Training Room): até 3 cartas lado a
 * lado dentro do mapa. Borda na cor da raridade; a selecionada ganha moldura
 * dourada e sobe um pouco.
 */
export class ChoiceScreen {
  private container: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  show({ title, options, selected }: GameEvents['choice-prompt']): void {
    this.close();
    const s = this.scene;
    const cx = MAP_VIEW.x + MAP_VIEW.width / 2;
    const items: Phaser.GameObjects.GameObject[] = [
      s.add.rectangle(MAP_VIEW.x, MAP_VIEW.y, MAP_VIEW.width, MAP_VIEW.height, 0x000000, 0.8).setOrigin(0),
      s.add.text(cx, MAP_VIEW.y + 18, title, textStyle(22, TEXT_COLORS.ACCENT)).setOrigin(0.5, 0),
      s.add
        .text(cx, MAP_VIEW.y + MAP_VIEW.height - 28, '←/→ escolher  ·  Enter / A: confirmar', textStyle(11, TEXT_COLORS.MUTED))
        .setOrigin(0.5, 0),
    ];

    const gap = 14;
    const total = options.length * CARD_W + (options.length - 1) * gap;
    options.forEach((opt, i) => {
      const x = cx - total / 2 + i * (CARD_W + gap);
      const isSel = i === selected;
      items.push(...this.drawCard(opt, x, MAP_VIEW.y + 70 - (isSel ? 6 : 0), isSel));
    });

    this.container = s.add.container(0, 0, items).setDepth(60);
    const scale = getRenderScale();
    for (const obj of items) if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(scale);
  }

  close(): void {
    this.container?.destroy();
    this.container = null;
  }

  private drawCard(opt: ChoiceOption, x: number, y: number, selected: boolean): Phaser.GameObjects.GameObject[] {
    const s = this.scene;
    const color = RARITY_COLORS[opt.rarity];
    const wrap = { wordWrap: { width: CARD_W - 16 } };
    return [
      s.add
        .rectangle(x, y, CARD_W, CARD_H, selected ? 0x22201a : 0x161616)
        .setOrigin(0)
        .setStrokeStyle(selected ? 3 : 2, selected ? COLORS.GOLD : color),
      s.add.rectangle(x, y, CARD_W, 6, color).setOrigin(0),
      s.add.text(x + 8, y + 14, opt.title, { ...textStyle(13), ...wrap, fontStyle: 'bold' }),
      s.add.text(x + 8, y + 52, opt.subtitle, { ...textStyle(10, cssColor(color)), ...wrap }),
      s.add.text(x + 8, y + 74, opt.description, { ...textStyle(11), ...wrap }).setLineSpacing(3),
    ];
  }
}
