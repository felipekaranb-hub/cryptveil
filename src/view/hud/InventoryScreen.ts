import Phaser from 'phaser';
import { COLORS, MAP_VIEW, TEXT_COLORS } from '../../config/display';
import type { InputSource } from '../../input/InputController';
import { getRenderScale } from '../scaling';
import type { InventoryView } from './model';
import { textStyle } from './ui';

const ROW_H = 18;
const LIST_TOP = MAP_VIEW.y + 44;
const LIST_BOTTOM = MAP_VIEW.y + MAP_VIEW.height - 56;
const VISIBLE_ROWS = Math.floor((LIST_BOTTOM - LIST_TOP) / ROW_H);

const CONTROLS = {
  keyboard: { pick: '↑/↓ escolher', confirm: 'Enter', rest: 'Q/E ou ←/→: aba  ·  I/Esc: fechar' },
  gamepad: { pick: 'D-pad ↑/↓ escolher', confirm: 'A', rest: 'LB/RB ou ←/→: aba  ·  Y/B: fechar' },
  shopKeyboard: { pick: '↑/↓ escolher', confirm: 'Enter', rest: 'Q/E ou ←/→: aba  ·  Esc: sair' },
  shopGamepad: { pick: 'D-pad ↑/↓ escolher', confirm: 'A', rest: 'LB/RB ou ←/→: aba  ·  B: sair' },
} as const;

/**
 * Inventário (I / Y) por cima do mapa, com 3 abas: Mochila (equipado +
 * itens usáveis), Pra vender (fora da vocação) e Deck (skills e cartas).
 * Os painéis laterais ficam à vista: HP e LOG continuam visíveis.
 * Redesenhado inteiro a cada atualização (é pouca coisa).
 */
export class InventoryScreen {
  private container: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get isOpen(): boolean {
    return this.container !== null;
  }

  show(view: InventoryView, source: InputSource): void {
    this.close();
    const s = this.scene;
    const left = MAP_VIEW.x;
    const items: Phaser.GameObjects.GameObject[] = [
      s.add.rectangle(left, MAP_VIEW.y, MAP_VIEW.width, MAP_VIEW.height, 0x050505, 0.92).setOrigin(0),
    ];

    // Abas
    const tabW = MAP_VIEW.width / view.tabs.length;
    view.tabs.forEach((label, i) => {
      const active = i === view.tab;
      const cx = left + tabW * i + tabW / 2;
      items.push(s.add.text(cx, MAP_VIEW.y + 12, label.toUpperCase(), textStyle(12, active ? TEXT_COLORS.ACCENT : TEXT_COLORS.MUTED)).setOrigin(0.5, 0));
      if (active) items.push(s.add.rectangle(cx - tabW / 2 + 16, MAP_VIEW.y + 32, tabW - 32, 2, COLORS.GOLD).setOrigin(0));
    });

    // Linhas, rolando pra manter a selecionada à vista
    const first = Math.max(0, Math.min(view.selected - Math.floor(VISIBLE_ROWS / 2), view.rows.length - VISIBLE_ROWS));
    view.rows.slice(first, first + VISIBLE_ROWS).forEach((row, i) => {
      const index = first + i;
      const y = LIST_TOP + i * ROW_H;
      const selected = index === view.selected;
      if (selected) items.push(s.add.rectangle(left + 8, y - 2, MAP_VIEW.width - 16, ROW_H, 0x2a2416).setOrigin(0));
      const color = row.header
        ? TEXT_COLORS.MUTED
        : row.tone === 'better'
          ? '#6fcf6f'
          : row.tone === 'worse'
            ? '#b08a80'
            : TEXT_COLORS.PRIMARY;
      const arrow = row.tone === 'better' ? ' ↑' : row.tone === 'worse' ? ' ↓' : '';
      items.push(
        s.add.text(left + 16, y, `${selected ? '▶ ' : row.header ? '' : '  '}${row.text}${arrow}`, textStyle(row.header ? 10 : 11, color)),
      );
      if (row.detail) {
        items.push(s.add.text(left + MAP_VIEW.width - 16, y, row.detail, textStyle(11, TEXT_COLORS.MUTED)).setOrigin(1, 0));
      }
    });
    if (first > 0) items.push(s.add.text(left + MAP_VIEW.width / 2, LIST_TOP - 12, '▲', textStyle(9, TEXT_COLORS.MUTED)).setOrigin(0.5, 0));
    if (first + VISIBLE_ROWS < view.rows.length) {
      items.push(s.add.text(left + MAP_VIEW.width / 2, LIST_BOTTOM - 4, '▼', textStyle(9, TEXT_COLORS.MUTED)).setOrigin(0.5, 0));
    }

    // Rodapé: o que a linha selecionada faz + controles
    const sel = view.rows[view.selected];
    // Na loja, I/Y não fecha (só Esc/B sai, pra não sair sem querer)
    const c = view.status !== undefined ? CONTROLS[source === 'keyboard' ? 'shopKeyboard' : 'shopGamepad'] : CONTROLS[source];
    const controls = [c.pick, ...(sel?.verb ? [`${c.confirm}: ${sel.verb}`] : []), c.rest].join('  ·  ');
    items.push(
      s.add.text(left + 16, LIST_BOTTOM + 10, sel && !sel.header ? sel.info : '', { ...textStyle(11, TEXT_COLORS.ACCENT), wordWrap: { width: MAP_VIEW.width - 150 } }),
      s.add.text(left + MAP_VIEW.width - 16, LIST_BOTTOM + 10, view.status ?? '', textStyle(11, TEXT_COLORS.ACCENT)).setOrigin(1, 0),
      s.add.text(left + MAP_VIEW.width / 2, MAP_VIEW.y + MAP_VIEW.height - 16, controls, textStyle(10, TEXT_COLORS.MUTED)).setOrigin(0.5),
    );

    this.container = s.add.container(0, 0, items).setDepth(50);
    const scale = getRenderScale();
    for (const obj of items) if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(scale);
  }

  close(): void {
    this.container?.destroy();
    this.container = null;
  }
}
