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

    if (view.confirm) items.push(...this.drawConfirm(view.confirm));

    this.container = s.add.container(0, 0, items).setDepth(50);
    const scale = getRenderScale();
    for (const obj of items) if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(scale);
  }

  /** Caixa de pergunta no meio do painel: opções lado a lado, a selecionada em dourado. */
  private drawConfirm(confirm: NonNullable<InventoryView['confirm']>): Phaser.GameObjects.GameObject[] {
    const s = this.scene;
    const w = 340;
    const h = 96;
    const x = MAP_VIEW.x + (MAP_VIEW.width - w) / 2;
    const y = MAP_VIEW.y + (MAP_VIEW.height - h) / 2;
    const objs: Phaser.GameObjects.GameObject[] = [
      s.add.rectangle(MAP_VIEW.x, MAP_VIEW.y, MAP_VIEW.width, MAP_VIEW.height, 0x000000, 0.55).setOrigin(0),
      s.add.rectangle(x, y, w, h, 0x161410).setOrigin(0).setStrokeStyle(2, COLORS.GOLD),
      s.add.text(x + w / 2, y + 12, confirm.title, textStyle(12, TEXT_COLORS.PRIMARY)).setOrigin(0.5, 0),
    ];
    const optW = (w - 36) / confirm.options.length;
    confirm.options.forEach((label, i) => {
      const ox = x + 12 + i * (optW + 12);
      const selected = i === confirm.selected;
      objs.push(
        s.add.rectangle(ox, y + 42, optW, 28, selected ? 0x2a2416 : 0x111111).setOrigin(0).setStrokeStyle(1, selected ? COLORS.GOLD : COLORS.FRAME),
        s.add.text(ox + optW / 2, y + 56, label, textStyle(11, selected ? TEXT_COLORS.ACCENT : TEXT_COLORS.MUTED)).setOrigin(0.5),
      );
    });
    objs.push(s.add.text(x + w / 2, y + h - 14, '←/→ escolher  ·  Enter/A confirmar  ·  Esc/B voltar', textStyle(9, TEXT_COLORS.MUTED)).setOrigin(0.5));
    return objs;
  }

  close(): void {
    this.container?.destroy();
    this.container = null;
  }
}
