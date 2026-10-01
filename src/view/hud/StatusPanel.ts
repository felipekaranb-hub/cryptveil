import Phaser from 'phaser';
import { COLORS, TEXT_COLORS } from '../../config/display';
import type { EquipSlot } from '../../core/items/Item';
import type { HudSnapshot } from './model';
import { LEFT_X, PANEL_H, PANEL_TOP, PANEL_W, textStyle } from './ui';

const X0 = LEFT_X + 12;
const INNER_W = PANEL_W - 24;
const SLOT = 28;
const SLOT_GAP = 4;
const DOLL_TOP = PANEL_TOP + 110;

/**
 * Posição de cada slot no paper doll, estilo Tibia (coluna, linha):
 *   Amuleto  Elmo      ·
 *   Arma     Armadura  Escudo
 *   Anel     Calça     ·
 *   ·        Botas     ·
 */
const DOLL_LAYOUT: Readonly<Record<EquipSlot, readonly [number, number]>> = {
  amulet: [0, 0],
  helmet: [1, 0],
  weapon: [0, 1],
  armor: [1, 1],
  shield: [2, 1],
  ring: [0, 2],
  legs: [1, 2],
  boots: [1, 3],
};

/** Sigla do slot vazio. */
const EMPTY_LABEL: Readonly<Record<EquipSlot, string>> = {
  helmet: 'elmo',
  amulet: 'amul',
  armor: 'arm',
  ring: 'anel',
  weapon: 'arma',
  shield: 'esc',
  legs: 'calç',
  boots: 'bota',
};

interface SlotView {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
}

/** Painel esquerdo: HP/Mana/XP, ATK/DEF, gold, paper doll de 8 slots e 3 relíquias. */
export class StatusPanel {
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly manaText: Phaser.GameObjects.Text;
  private readonly manaFill: Phaser.GameObjects.Rectangle;
  private readonly xpText: Phaser.GameObjects.Text;
  private readonly xpFill: Phaser.GameObjects.Rectangle;
  private readonly statsText: Phaser.GameObjects.Text;
  private readonly slots = new Map<EquipSlot, SlotView>();
  private readonly relics: SlotView[] = [];
  readonly padText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    scene.add.rectangle(LEFT_X, PANEL_TOP, PANEL_W, PANEL_H, 0x111111).setOrigin(0).setStrokeStyle(1, COLORS.FRAME);
    scene.add.text(X0, PANEL_TOP + 8, 'KNIGHT', textStyle(11, TEXT_COLORS.ACCENT));
    this.levelText = scene.add.text(X0 + INNER_W, PANEL_TOP + 8, '', textStyle(11, TEXT_COLORS.ACCENT)).setOrigin(1, 0);

    const bar = (y: number, color: number, h = 5): Phaser.GameObjects.Rectangle => {
      scene.add.rectangle(X0, y, INNER_W, h, 0x000000).setOrigin(0);
      return scene.add.rectangle(X0, y, INNER_W, h, color).setOrigin(0);
    };
    this.hpText = scene.add.text(X0, PANEL_TOP + 26, '', textStyle(11));
    this.hpFill = bar(PANEL_TOP + 41, COLORS.BLOOD_RED);
    this.manaText = scene.add.text(X0, PANEL_TOP + 50, '', textStyle(11));
    this.manaFill = bar(PANEL_TOP + 65, COLORS.MANA_BLUE);
    this.xpText = scene.add.text(X0, PANEL_TOP + 74, '', textStyle(11));
    this.xpFill = bar(PANEL_TOP + 89, COLORS.GOLD, 3);

    // Paper doll à esquerda, números à direita
    for (const [slot, [col, row]] of Object.entries(DOLL_LAYOUT) as [EquipSlot, readonly [number, number]][]) {
      this.slots.set(slot, this.slotBox(scene, X0 + col * (SLOT + SLOT_GAP), DOLL_TOP + row * (SLOT + SLOT_GAP)));
    }
    this.statsText = scene.add
      .text(X0 + 3 * (SLOT + SLOT_GAP) + 8, DOLL_TOP, '', textStyle(11))
      .setLineSpacing(5);

    const relicTop = DOLL_TOP + 4 * (SLOT + SLOT_GAP) + 8;
    scene.add.text(X0, relicTop, 'RELÍQUIAS', textStyle(9, TEXT_COLORS.MUTED));
    for (let i = 0; i < 3; i++) {
      this.relics.push(this.slotBox(scene, X0 + i * (SLOT + SLOT_GAP), relicTop + 14));
    }

    this.padText = scene.add.text(X0, PANEL_TOP + PANEL_H - 20, '', textStyle(10, TEXT_COLORS.MUTED));
  }

  private slotBox(scene: Phaser.Scene, x: number, y: number): SlotView {
    const box = scene.add.rectangle(x, y, SLOT, SLOT, 0x161616).setOrigin(0).setStrokeStyle(1, COLORS.FRAME);
    const label = scene.add.text(x + SLOT / 2, y + SLOT / 2, '', textStyle(8, TEXT_COLORS.MUTED)).setOrigin(0.5);
    return { box, label };
  }

  update(s: HudSnapshot): void {
    const ratio = (v: number, max: number): number => (max > 0 ? Math.max(0, Math.min(1, v / max)) : 0);
    this.levelText.setText(`Nível ${s.level}`);
    this.hpText.setText(`HP ${s.hp}/${s.maxHp}`);
    this.hpFill.width = Math.round(INNER_W * ratio(s.hp, s.maxHp));
    this.manaText.setText(`Mana ${s.mana}/${s.maxMana}`);
    this.manaFill.width = Math.round(INNER_W * ratio(s.mana, s.maxMana));
    this.xpText.setText(`XP ${s.xp}/${s.xpNext}`);
    this.xpFill.width = Math.round(INNER_W * ratio(s.xp, s.xpNext));
    this.statsText.setText(
      [`ATK ${s.atk}`, `DEF ${s.def}`, `Gold ${s.gold}`, `Andar ${s.floor}`, `Turno ${s.turn}`, `Deck ${s.deckSize}`].join('\n'),
    );

    for (const g of s.gear) {
      const view = this.slots.get(g.slot);
      if (!view) continue;
      if (g.item) {
        view.box.setStrokeStyle(1, COLORS.GOLD);
        view.label.setText(initials(g.item)).setColor(TEXT_COLORS.PRIMARY).setFontSize(10).setFontStyle('bold');
      } else {
        view.box.setStrokeStyle(1, COLORS.FRAME);
        view.label.setText(EMPTY_LABEL[g.slot]).setColor(TEXT_COLORS.MUTED).setFontSize(8).setFontStyle('');
      }
    }
    s.relics.forEach((r, i) => {
      const view = this.relics[i];
      if (!view) return;
      view.label.setText(r ? initials(r) : '—').setColor(r ? TEXT_COLORS.PRIMARY : TEXT_COLORS.MUTED);
      view.box.setStrokeStyle(1, r ? COLORS.GOLD : COLORS.FRAME);
    });
  }
}

/** Sigla provisória do item até os sprites do Marco 6: "Spike Sword" → "SS", "Sword" → "Sw". */
function initials(name: string): string {
  const words = name.split(' ').filter(Boolean);
  if (words.length === 1) return name.slice(0, 2);
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
