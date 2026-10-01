import Phaser from 'phaser';
import { COLORS, MAP_VIEW, TEXT_COLORS } from '../../config/display';
import type { ChoiceOption, GameEvents } from '../events';
import { getRenderScale } from '../scaling';
import { cssColor, textStyle } from './ui';

const CARD_W = 140;
const CARD_H = 190;
const GAP = 14;
/** Cor da borda por raridade (epic = roxo, a mais rara). */
const RARITY_COLORS = { common: 0x8a8578, rare: 0x3d7fd1, epic: 0xa45ee5, training: 0xc9a55c } as const;

/**
 * Tela de escolha (cartas do level up / Training Room): até 4 cartas lado a
 * lado dentro do mapa (4 com o Tome "Saber": encolhem pra caber). Borda na cor da raridade; a selecionada ganha moldura
 * dourada e sobe um pouco.
 */
export class ChoiceScreen {
  private container: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  show({ title, options, selected, rerolls }: GameEvents['choice-prompt']): void {
    this.close();
    const s = this.scene;
    const cx = MAP_VIEW.x + MAP_VIEW.width / 2;
    const items: Phaser.GameObjects.GameObject[] = [
      s.add.rectangle(MAP_VIEW.x, MAP_VIEW.y, MAP_VIEW.width, MAP_VIEW.height, 0x000000, 0.8).setOrigin(0),
      s.add.text(cx, MAP_VIEW.y + 18, title, textStyle(22, TEXT_COLORS.ACCENT)).setOrigin(0.5, 0),
      s.add
        .text(
          cx,
          MAP_VIEW.y + MAP_VIEW.height - 28,
          `←/→ escolher  ·  Enter / A: confirmar${rerolls > 0 ? `  ·  Espaço / X: rerrolar (${rerolls})` : ''}`,
          textStyle(11, TEXT_COLORS.MUTED),
        )
        .setOrigin(0.5, 0),
    ];

    const n = Math.max(1, options.length);
    const cardW = Math.min(CARD_W, Math.floor((MAP_VIEW.width - 16 - (n - 1) * GAP) / n));
    const total = n * cardW + (n - 1) * GAP;
    options.forEach((opt, i) => {
      const x = cx - total / 2 + i * (cardW + GAP);
      const isSel = i === selected;
      items.push(...this.drawCard(opt, x, MAP_VIEW.y + 70 - (isSel ? 6 : 0), isSel, cardW));
    });

    this.container = s.add.container(0, 0, items).setDepth(60);
    const scale = getRenderScale();
    for (const obj of items) if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(scale);
  }

  close(): void {
    this.container?.destroy();
    this.container = null;
  }

  private drawCard(
    opt: ChoiceOption,
    x: number,
    y: number,
    selected: boolean,
    cardW: number,
  ): Phaser.GameObjects.GameObject[] {
    const s = this.scene;
    const color = RARITY_COLORS[opt.rarity];
    const wrap = { wordWrap: { width: cardW - 16 } };
    // Empilha pela altura real: carta estreita (4 opções) quebra o título em 2 linhas
    const title = s.add.text(x + 8, y + 14, opt.title, { ...textStyle(13), ...wrap, fontStyle: 'bold' });
    const subY = Math.max(y + 52, title.y + title.height + 6);
    const subtitle = s.add.text(x + 8, subY, opt.subtitle, { ...textStyle(10, cssColor(color)), ...wrap });
    const descY = Math.max(y + 74, subtitle.y + subtitle.height + 8);
    return [
      s.add
        .rectangle(x, y, cardW, CARD_H, selected ? 0x22201a : 0x161616)
        .setOrigin(0)
        .setStrokeStyle(selected ? 3 : 2, selected ? COLORS.GOLD : color),
      s.add.rectangle(x, y, cardW, 6, color).setOrigin(0),
      title,
      subtitle,
      s.add.text(x + 8, descY, opt.description, { ...textStyle(11), ...wrap }).setLineSpacing(3),
    ];
  }
}
