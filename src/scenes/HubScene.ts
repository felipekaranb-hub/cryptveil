import Phaser from 'phaser';
import type { Action } from '../core/actions';
import { ENTITY_TEMPLATES } from '../core/data/entities';
import { BESTIARY, BUILDINGS, maxUpgradeLevel, UPGRADES, upgradesOf, type BuildingId, type UpgradeId } from '../core/data/sanctum';
import {
  buyUpgrade,
  conversionRate,
  nextUpgradeCost,
  upgradeLevel,
  type MetaProgress,
} from '../core/meta/metaProgress';
import { randomSeed } from '../core/rng';
import type { RunState } from '../core/run';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS, TEXT_COLORS, TILE_SIZE } from '../config/display';
import { InputController } from '../input/InputController';
import { closeRun, loadMeta, saveMeta } from '../storage/metaStorage';
import { clearRun, loadRun } from '../storage/runStorage';
import { textStyle } from '../view/hud/ui';
import { ATLAS, ENTITY_FRAMES, SPRITE_SCALE, TILE_FRAMES } from '../config/sprites';
import { playSfx, toggleMute } from '../view/audio/sfx';
import { bindRenderScale, getRenderScale, layoutCamera } from '../view/scaling';
import type { GameSceneData } from './GameScene';

type MenuId = 'continue' | 'new' | BuildingId | 'bestiary';

const MENU_X = 96;

/** Ícone de cada entrada do menu (atlas do Marco 6b). */
const MENU_ICONS: Record<MenuId, number> = {
  continue: ENTITY_FRAMES['Knight'] ?? 97,
  new: TILE_FRAMES.stairs,
  vault: 91,
  armory: 118,
  tome: 63,
  bestiary: ENTITY_FRAMES['Skeleton'] ?? 121,
};
const MENU_Y = 150;
const ROW_H = 34;
const PANEL_X = 400;
const PANEL_Y = 132;
const PANEL_W = GAME_WIDTH - PANEL_X - 50;
const PANEL_H = 330;
const BAD = '#e05a4a';

/**
 * Sanctum (Marco 5): tela inicial e o lugar entre runs. Gasta o gold
 * guardado nos 3 prédios, mostra o bestiário e começa (ou continua) a run.
 * ↑/↓ escolhe, Enter/A entra ou compra, Esc/B volta. Tudo funciona no controle.
 */
export class HubScene extends Phaser.Scene {
  private meta!: MetaProgress;
  private suspended: RunState | null = null;
  private menu: MenuId[] = [];
  private selected = 0;
  /** 'building': escolhendo upgrade dentro do prédio; 'confirm': abandonar a run suspensa? */
  private mode: 'menu' | 'building' | 'confirm' = 'menu';
  private upgradeRow = 0;
  private confirmYes = false;
  private message: { text: string; color: string } | null = null;
  private view: Phaser.GameObjects.Container | null = null;
  private controls!: InputController;

  constructor() {
    super(SCENE_KEYS.HUB);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.BACKGROUND);
    this.drawBackdrop();
    this.meta = loadMeta();
    this.suspended = loadRun();
    this.menu = [
      ...(this.suspended ? (['continue'] as const) : []),
      'new',
      'vault',
      'armory',
      'tome',
      'bestiary',
    ];
    this.selected = 0;
    this.mode = 'menu';
    this.message = null;
    this.view = null;

    this.controls = new InputController(this);
    this.controls.onAction((action) => this.handleAction(action));
    bindRenderScale(this, (scale) =>
      layoutCamera(this.cameras.main, scale, { x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT }),
    );
    this.render();
  }

  override update(time: number): void {
    this.controls.update(time);
  }

  /**
   * Fundo do Sanctum: a cripta bem escura (chão do Tiny Dungeon) com uma
   * fileira de parede no topo. Fica atrás de tudo e não muda com o input.
   */
  private drawBackdrop(): void {
    const t = TILE_SIZE;
    for (let y = 0; y < Math.ceil(GAME_HEIGHT / t); y++) {
      for (let x = 0; x < Math.ceil(GAME_WIDTH / t); x++) {
        const frame = y < 1 ? TILE_FRAMES.wallFace : TILE_FRAMES.floor[(x * 7 + y * 13) % TILE_FRAMES.floor.length];
        this.add
          .image(x * t, y * t, ATLAS.key, frame)
          .setOrigin(0)
          .setScale(SPRITE_SCALE)
          .setTint(y < 1 ? 0x5a5250 : 0x3c342e)
          .setDepth(-10);
      }
    }
  }

  // ------------------------------------------------------------------- input

  private handleAction(action: Action): void {
    if (action.type === 'mute') {
      this.message = { text: toggleMute() ? 'Som desligado (M / Select)' : 'Som ligado', color: TEXT_COLORS.MUTED };
      this.render();
      return;
    }
    if (action.type === 'move') playSfx('uiMove');
    else if (action.type === 'confirm') playSfx('uiConfirm');
    if (this.mode === 'confirm') this.handleConfirm(action);
    else if (this.mode === 'building') this.handleBuilding(action);
    else this.handleMenu(action);
    this.render();
  }

  private handleMenu(action: Action): void {
    const id = this.menu[this.selected];
    if (action.type === 'move' && (action.dir === 'N' || action.dir === 'S')) {
      const n = this.menu.length;
      this.selected = (this.selected + (action.dir === 'N' ? -1 : 1) + n) % n;
      this.message = null;
      return;
    }
    if (action.type !== 'confirm' && !(action.type === 'move' && action.dir === 'E')) return;
    switch (id) {
      case 'continue':
        if (action.type === 'confirm') this.startGame({ resume: true });
        return;
      case 'new':
        if (action.type !== 'confirm') return;
        if (this.suspended) {
          this.mode = 'confirm';
          this.confirmYes = false;
        } else {
          this.startGame({ seed: randomSeed() });
        }
        return;
      case 'vault':
      case 'armory':
      case 'tome':
        this.mode = 'building';
        this.upgradeRow = 0;
        this.message = null;
        return;
      default:
        return;
    }
  }

  private handleBuilding(action: Action): void {
    const building = this.menu[this.selected] as BuildingId;
    const upgrades = upgradesOf(building);
    if (action.type === 'move' && (action.dir === 'N' || action.dir === 'S')) {
      const n = upgrades.length;
      this.upgradeRow = (this.upgradeRow + (action.dir === 'N' ? -1 : 1) + n) % n;
      this.message = null;
    } else if (action.type === 'cancel' || (action.type === 'move' && action.dir === 'W')) {
      this.mode = 'menu';
      this.message = null;
    } else if (action.type === 'confirm') {
      const id = upgrades[this.upgradeRow];
      if (id) this.buy(id);
    }
  }

  private handleConfirm(action: Action): void {
    if (action.type === 'move' && (action.dir === 'W' || action.dir === 'E')) {
      this.confirmYes = !this.confirmYes;
    } else if (action.type === 'cancel') {
      this.mode = 'menu';
    } else if (action.type === 'confirm') {
      if (!this.confirmYes) {
        this.mode = 'menu';
        return;
      }
      // Abandonar a suspensa conta como morte: o gold dela converte agora
      if (this.suspended) closeRun(this.suspended, 'abandoned');
      clearRun();
      this.startGame({ seed: randomSeed() });
    }
  }

  private buy(id: UpgradeId): void {
    const def = UPGRADES[id];
    const done = buyUpgrade(this.meta, id);
    if (done === true) {
      playSfx('buy');
      saveMeta(this.meta);
      this.message = { text: `${def.name} nível ${upgradeLevel(this.meta, id)}!`, color: TEXT_COLORS.ACCENT };
    } else {
      playSfx('uiDeny');
      this.message = { text: done === 'maxed' ? `${def.name} já está no máximo` : 'Gold insuficiente', color: BAD };
    }
  }

  private startGame(data: GameSceneData): void {
    this.scene.start(SCENE_KEYS.GAME, data);
  }

  // ------------------------------------------------------------------ desenho

  /** Redesenha a tela inteira (barato: poucos textos, só muda com input). */
  private render(): void {
    this.view?.destroy();
    const items: Phaser.GameObjects.GameObject[] = [];
    const text = (x: number, y: number, str: string, size: number, color: string = TEXT_COLORS.PRIMARY): Phaser.GameObjects.Text => {
      const t = this.add.text(x, y, str, textStyle(size, color));
      items.push(t);
      return t;
    };

    text(GAME_WIDTH / 2, 30, 'SANCTUM', 32, TEXT_COLORS.ACCENT).setOrigin(0.5, 0);
    const m = this.meta;
    text(
      GAME_WIDTH / 2,
      74,
      `Gold guardado: ${m.gold}   ·   runs ${m.runs}   ·   vitórias ${m.wins}   ·   melhor andar ${m.bestFloor || '—'}`,
      13,
      TEXT_COLORS.MUTED,
    ).setOrigin(0.5, 0);

    this.menu.forEach((id, i) => {
      const sel = i === this.selected;
      const active = sel && this.mode === 'menu';
      const label = this.menuLabel(id);
      const y = MENU_Y + i * ROW_H;
      text(MENU_X - 34, y, sel ? '▶' : ' ', 16, active ? TEXT_COLORS.ACCENT : TEXT_COLORS.MUTED);
      items.push(
        this.add
          .image(MENU_X - 2, y + 11, ATLAS.key, MENU_ICONS[id])
          .setScale(1.5)
          .setTint(sel ? 0xffffff : 0x9a948c),
      );
      text(MENU_X + 18, y, label, 16, sel ? TEXT_COLORS.ACCENT : TEXT_COLORS.PRIMARY);
    });

    items.push(
      this.add.rectangle(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0x111111).setOrigin(0).setStrokeStyle(1, COLORS.FRAME),
    );
    this.renderPanel(text);

    if (this.message) text(PANEL_X + 16, PANEL_Y + PANEL_H - 26, this.message.text, 12, this.message.color);
    text(GAME_WIDTH / 2, GAME_HEIGHT - 40, this.helpLine(), 11, TEXT_COLORS.MUTED).setOrigin(0.5, 0);

    this.view = this.add.container(0, 0, items);
    const scale = getRenderScale();
    for (const obj of items) if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(scale);
  }

  private menuLabel(id: MenuId): string {
    switch (id) {
      case 'continue':
        return 'Continuar run';
      case 'new':
        return this.suspended ? 'Nova run' : 'Descer à cripta';
      case 'bestiary':
        return 'Bestiário';
      default:
        return BUILDINGS[id].name;
    }
  }

  private helpLine(): string {
    if (this.mode === 'confirm') return '←/→ escolher  ·  Enter / A: confirmar  ·  Esc / B: voltar';
    if (this.mode === 'building') return '↑/↓ escolher  ·  Enter / A: comprar  ·  Esc / B: voltar';
    return '↑/↓ escolher  ·  Enter / A: entrar';
  }

  private renderPanel(text: (x: number, y: number, s: string, size: number, color?: string) => Phaser.GameObjects.Text): void {
    const x = PANEL_X + 16;
    let y = PANEL_Y + 14;
    const id = this.menu[this.selected];
    const wrap = { wordWrap: { width: PANEL_W - 32 } };

    if (this.mode === 'confirm') {
      const run = this.suspended;
      text(x, y, 'ABANDONAR A RUN SUSPENSA?', 15, TEXT_COLORS.ACCENT);
      y += 34;
      const pct = Math.round(conversionRate(this.meta, false) * 100);
      text(
        x,
        y,
        `Andar ${run?.floor ?? '?'}, nível ${run?.hero.level ?? '?'}, ${run?.hero.gold ?? 0} de gold.\n` +
          `Conta como morte: ${pct}% do gold vai pro Sanctum e as kills entram no bestiário.`,
        12,
      ).setStyle(wrap).setLineSpacing(4);
      y += 80;
      text(x, y, this.confirmYes ? '▶ Sim, nova run' : '  Sim, nova run', 14, this.confirmYes ? TEXT_COLORS.ACCENT : TEXT_COLORS.PRIMARY);
      text(x + 200, y, !this.confirmYes ? '▶ Não' : '  Não', 14, !this.confirmYes ? TEXT_COLORS.ACCENT : TEXT_COLORS.PRIMARY);
      return;
    }

    switch (id) {
      case 'continue': {
        const run = this.suspended;
        if (!run) return;
        text(x, y, 'RUN SUSPENSA', 15, TEXT_COLORS.ACCENT);
        text(
          x,
          y + 34,
          `Andar ${run.floor}  ·  nível ${run.hero.level}  ·  turno ${run.turn}\nGold na mochila: ${run.hero.gold}\nSeed ${run.seed}`,
          12,
        ).setLineSpacing(6);
        return;
      }
      case 'new': {
        text(x, y, 'DESCER À CRIPTA', 15, TEXT_COLORS.ACCENT);
        const pct = Math.round(conversionRate(this.meta, false) * 100);
        text(
          x,
          y + 34,
          'Cinco andares, o Orc Warlord no último.\n\n' +
            `No fim da run, o gold que sobrar vem pro Sanctum: 100% se vencer, ${pct}% se morrer. ` +
            'Gastar no mercador ajuda agora; guardar ajuda as próximas.',
          12,
        ).setStyle(wrap).setLineSpacing(4);
        return;
      }
      case 'bestiary':
        this.renderBestiary(text, x, y);
        return;
      case undefined:
        return;
      default:
        this.renderBuilding(id, text, x, y);
    }
  }

  private renderBuilding(
    building: BuildingId,
    text: (x: number, y: number, s: string, size: number, color?: string) => Phaser.GameObjects.Text,
    x: number,
    y: number,
  ): void {
    text(x, y, BUILDINGS[building].name.toUpperCase(), 15, TEXT_COLORS.ACCENT);
    text(x, y + 22, BUILDINGS[building].blurb, 11, TEXT_COLORS.MUTED);
    let rowY = y + 56;
    upgradesOf(building).forEach((id, i) => {
      const def = UPGRADES[id];
      const level = upgradeLevel(this.meta, id);
      const max = maxUpgradeLevel(id);
      const cost = nextUpgradeCost(this.meta, id);
      const sel = this.mode === 'building' && i === this.upgradeRow;
      const pips = '■'.repeat(level) + '□'.repeat(max - level);
      text(x - 4, rowY, sel ? '▶' : ' ', 13, TEXT_COLORS.ACCENT);
      text(x + 12, rowY, `${def.name}  ${pips}  nível ${level}/${max}`, 13, sel ? TEXT_COLORS.ACCENT : TEXT_COLORS.PRIMARY);
      if (level > 0) text(x + 12, rowY + 20, `Agora: ${def.levels[level - 1]}`, 11, TEXT_COLORS.MUTED);
      if (cost === null) {
        text(x + 12, rowY + 38, 'No máximo', 11, TEXT_COLORS.MUTED);
      } else {
        text(
          x + 12,
          rowY + 38,
          `Próximo: ${def.levels[level]} — ${cost}g`,
          11,
          this.meta.gold >= cost ? TEXT_COLORS.PRIMARY : BAD,
        );
      }
      rowY += 74;
    });
  }

  private renderBestiary(
    text: (x: number, y: number, s: string, size: number, color?: string) => Phaser.GameObjects.Text,
    x: number,
    y: number,
  ): void {
    text(x, y, 'BESTIÁRIO', 15, TEXT_COLORS.ACCENT);
    text(x, y + 22, 'Região 1. Os stats aparecem depois da primeira kill.', 11, TEXT_COLORS.MUTED);
    let rowY = y + 56;
    for (const species of BESTIARY) {
      const t = ENTITY_TEMPLATES[species];
      const kills = this.meta.kills[species] ?? 0;
      if (kills > 0) {
        const boss = 'boss' in t && t.boss ? '  (boss)' : '';
        text(x, rowY, `${t.name}${boss}`, 13, TEXT_COLORS.PRIMARY);
        text(x + 230, rowY, `${kills} kill${kills > 1 ? 's' : ''}`, 13, TEXT_COLORS.ACCENT);
        text(
          x,
          rowY + 19,
          `HP ${t.maxHp} · ATK ${t.atk} · DEF ${t.def} · XP ${t.reward.xp} · gold ${t.reward.goldMin}–${t.reward.goldMax}`,
          11,
          TEXT_COLORS.MUTED,
        );
      } else {
        text(x, rowY, '???', 13, TEXT_COLORS.MUTED);
        text(x, rowY + 19, 'Ainda não abatido', 11, TEXT_COLORS.MUTED);
      }
      rowY += 46;
    }
  }
}
