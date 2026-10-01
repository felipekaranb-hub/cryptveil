import Phaser from 'phaser';
import {
  COLORS,
  FONT_FAMILY,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAP_VIEW,
  SCENE_KEYS,
  TEXT_COLORS,
} from '../config/display';
import { onGameEvent, offGameEvent, type ChoiceOption, type GameEvents } from '../view/events';
import { bindRenderScale, getRenderScale, layoutCamera } from '../view/scaling';

const LOG_LINES = 14;
const PANEL_W = MAP_VIEW.x - 32;
const LEFT_X = 16;
const RIGHT_X = MAP_VIEW.x + MAP_VIEW.width + 16;
const HP_BAR_W = PANEL_W - 24;
const CARD_W = 140;
const CARD_H = 190;
/** Cor da borda por raridade (epic = roxo, a mais rara). */
const RARITY_COLORS = { common: 0x8a8578, rare: 0x3d7fd1, epic: 0xa45ee5, training: 0xc9a55c } as const;

/**
 * HUD por cima do mundo, com câmera própria (não se mexe quando a câmera
 * do mapa seguir o player no Marco 2). Só exibe o que a GameScene manda.
 * Marco 3 substitui por HUD completo (equipamento, hotbar, mini-mapa).
 */
export class UIScene extends Phaser.Scene {
  private subtitle!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private hpFill!: Phaser.GameObjects.Rectangle;
  private manaText!: Phaser.GameObjects.Text;
  private manaFill!: Phaser.GameObjects.Rectangle;
  private statsText!: Phaser.GameObjects.Text;
  private padText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlaySub!: Phaser.GameObjects.Text;
  private hotbarText!: Phaser.GameObjects.Text;
  /** Tela de escolha (cartas / Training Room), recriada a cada atualização. */
  private choice: Phaser.GameObjects.Container | null = null;
  private log: string[] = [];

  constructor() {
    super(SCENE_KEYS.UI);
  }

  create(): void {
    this.log = [];

    // Moldura em volta do mapa
    this.add
      .rectangle(MAP_VIEW.x - 2, MAP_VIEW.y - 2, MAP_VIEW.width + 4, MAP_VIEW.height + 4)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.FRAME);

    this.add.text(GAME_WIDTH / 2, 22, 'CRYPTVEIL', style(28, TEXT_COLORS.ACCENT)).setOrigin(0.5, 0);
    this.subtitle = this.add
      .text(GAME_WIDTH / 2, 56, 'Marco 2d', style(12, TEXT_COLORS.MUTED))
      .setOrigin(0.5, 0);

    // --- painel esquerdo: status do Knight
    this.drawPanel(LEFT_X, 'KNIGHT');
    const y0 = MAP_VIEW.y + 28;
    this.hpText = this.add.text(LEFT_X + 12, y0, '', style(12));
    this.add.rectangle(LEFT_X + 12, y0 + 18, HP_BAR_W, 6, 0x000000).setOrigin(0);
    this.hpFill = this.add.rectangle(LEFT_X + 12, y0 + 18, HP_BAR_W, 6, COLORS.BLOOD_RED).setOrigin(0);
    this.manaText = this.add.text(LEFT_X + 12, y0 + 30, '', style(12));
    this.add.rectangle(LEFT_X + 12, y0 + 48, HP_BAR_W, 6, 0x000000).setOrigin(0);
    this.manaFill = this.add.rectangle(LEFT_X + 12, y0 + 48, HP_BAR_W, 6, COLORS.MANA_BLUE).setOrigin(0);
    this.statsText = this.add.text(LEFT_X + 12, y0 + 64, '', style(11)).setLineSpacing(4);
    this.padText = this.add.text(LEFT_X + 12, MAP_VIEW.y + MAP_VIEW.height - 32, '', style(11, TEXT_COLORS.MUTED));

    // --- painel direito: log de combate
    this.drawPanel(RIGHT_X, 'LOG');
    this.logText = this.add
      .text(RIGHT_X + 12, MAP_VIEW.y + 32, '', {
        ...style(11),
        wordWrap: { width: PANEL_W - 24 },
      })
      .setLineSpacing(4);

    // Hotbar provisória (Marco 3: hotbar de verdade, com mapeamento no controle)
    this.hotbarText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 44, '', style(11, TEXT_COLORS.ACCENT)).setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 24,
        'WASD/Setas ou D-pad: mover e atacar  ·  Espaço / X: passar turno  ·  Enter / A: confirmar',
        style(11, TEXT_COLORS.MUTED),
      )
      .setOrigin(0.5);

    this.createOverlay();

    this.updatePadStatus();
    this.input.gamepad?.on('connected', () => this.updatePadStatus());
    this.input.gamepad?.on('disconnected', () => this.updatePadStatus());

    const events = this.game.events;
    onGameEvent(events, 'run-started', this.onRunStarted, this);
    onGameEvent(events, 'resume-offered', this.onResumeOffered, this);
    onGameEvent(events, 'player-status', this.onPlayerStatus, this);
    onGameEvent(events, 'log', this.onLog, this);
    onGameEvent(events, 'run-ended', this.onRunEnded, this);
    onGameEvent(events, 'choice-prompt', this.onChoicePrompt, this);
    onGameEvent(events, 'choice-closed', this.onChoiceClosed, this);

    // HUD em coordenadas lógicas 960×540, desenhado na resolução real
    bindRenderScale(this, (scale) =>
      layoutCamera(this.cameras.main, scale, { x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT }),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offGameEvent(events, 'run-started', this.onRunStarted, this);
      offGameEvent(events, 'resume-offered', this.onResumeOffered, this);
      offGameEvent(events, 'player-status', this.onPlayerStatus, this);
      offGameEvent(events, 'log', this.onLog, this);
      offGameEvent(events, 'run-ended', this.onRunEnded, this);
      offGameEvent(events, 'choice-prompt', this.onChoicePrompt, this);
      offGameEvent(events, 'choice-closed', this.onChoiceClosed, this);
    });
  }

  // ------------------------------------------------------------------ montagem

  private drawPanel(x: number, title: string): void {
    this.add
      .rectangle(x, MAP_VIEW.y, PANEL_W, MAP_VIEW.height, 0x111111)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.FRAME);
    this.add.text(x + 12, MAP_VIEW.y + 8, title, style(11, TEXT_COLORS.ACCENT));
  }

  private createOverlay(): void {
    const cx = MAP_VIEW.x + MAP_VIEW.width / 2;
    const cy = MAP_VIEW.y + MAP_VIEW.height / 2;
    const shade = this.add.rectangle(MAP_VIEW.x, MAP_VIEW.y, MAP_VIEW.width, MAP_VIEW.height, 0x000000, 0.72).setOrigin(0);
    this.overlayTitle = this.add.text(cx, cy - 18, '', style(36)).setOrigin(0.5);
    this.overlaySub = this.add
      .text(cx, cy + 18, '', { ...style(12, TEXT_COLORS.PRIMARY), align: 'center' })
      .setOrigin(0.5, 0);
    this.overlay = this.add.container(0, 0, [shade, this.overlayTitle, this.overlaySub]).setVisible(false);
  }

  // ------------------------------------------------------------------ eventos

  private onRunStarted({ seed }: GameEvents['run-started']): void {
    this.subtitle.setText(`Marco 2d  ·  seed ${seed}`);
    this.overlay.setVisible(false);
  }

  private onResumeOffered({ seed, floor, turn }: GameEvents['resume-offered']): void {
    this.subtitle.setText(`Marco 2d  ·  seed ${seed}`);
    this.overlayTitle.setText('RUN SUSPENSA').setColor(TEXT_COLORS.ACCENT).setFontSize(28);
    this.overlaySub.setText(
      `Andar ${floor}  ·  turno ${turn}\n\nEnter / A: continuar\nEsc / B: nova run`,
    );
    this.overlay.setVisible(true);
  }

  private onPlayerStatus(s: GameEvents['player-status']): void {
    this.hpText.setText(`HP ${s.hp}/${s.maxHp}`);
    this.hpFill.width = Math.round(HP_BAR_W * Math.max(0, s.hp / s.maxHp));
    this.manaText.setText(`Mana ${s.mana}/${s.maxMana}`);
    this.manaFill.width = Math.round(HP_BAR_W * Math.max(0, s.mana / s.maxMana));
    this.hotbarText.setText(s.hotbar);
    this.statsText.setText(
      [
        `Nível ${s.level}  ·  XP ${s.xp}/${s.xpNext}`,
        `Gold ${s.gold}`,
        `ATK ${s.atk}   DEF ${s.def}`,
        `Andar ${s.floor}  ·  Turno ${s.turn}`,
        '',
        `Poções  HP ${s.potions.hp}  ·  Mana ${s.potions.mana}`,
        '',
        `Arma    ${s.gear.weapon}`,
        `Armad.  ${s.gear.armor}`,
        `Elmo    ${s.gear.helmet}`,
        `Escudo  ${s.gear.shield}`,
      ].join('\n'),
    );
  }

  /**
   * Tela de escolha: até 3 cartas lado a lado dentro do mapa. Borda na cor
   * da raridade; a selecionada ganha moldura dourada e sobe um pouco.
   */
  private onChoicePrompt({ title, options, selected }: GameEvents['choice-prompt']): void {
    this.choice?.destroy();
    const scale = getRenderScale();
    const cx = MAP_VIEW.x + MAP_VIEW.width / 2;
    const items: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(MAP_VIEW.x, MAP_VIEW.y, MAP_VIEW.width, MAP_VIEW.height, 0x000000, 0.8).setOrigin(0),
      this.add.text(cx, MAP_VIEW.y + 18, title, style(22, TEXT_COLORS.ACCENT)).setOrigin(0.5, 0),
      this.add
        .text(cx, MAP_VIEW.y + MAP_VIEW.height - 28, '←/→ escolher  ·  Enter / A: confirmar', style(11, TEXT_COLORS.MUTED))
        .setOrigin(0.5, 0),
    ];

    const w = CARD_W;
    const gap = 14;
    const total = options.length * w + (options.length - 1) * gap;
    options.forEach((opt, i) => {
      const x = cx - total / 2 + i * (w + gap);
      const isSel = i === selected;
      const y = MAP_VIEW.y + 70 - (isSel ? 6 : 0);
      items.push(...this.drawCard(opt, x, y, isSel));
    });

    this.choice = this.add.container(0, 0, items);
    for (const obj of items) if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(scale);
  }

  private drawCard(opt: ChoiceOption, x: number, y: number, selected: boolean): Phaser.GameObjects.GameObject[] {
    const color = RARITY_COLORS[opt.rarity];
    const bg = this.add
      .rectangle(x, y, CARD_W, CARD_H, selected ? 0x22201a : 0x161616)
      .setOrigin(0)
      .setStrokeStyle(selected ? 3 : 2, selected ? COLORS.GOLD : color);
    const band = this.add.rectangle(x, y, CARD_W, 6, color).setOrigin(0);
    const wrap = { wordWrap: { width: CARD_W - 16 } };
    const titleText = this.add.text(x + 8, y + 14, opt.title, { ...style(13), ...wrap, fontStyle: 'bold' });
    const sub = this.add.text(x + 8, y + 52, opt.subtitle, { ...style(10, `#${color.toString(16).padStart(6, '0')}`), ...wrap });
    const desc = this.add.text(x + 8, y + 74, opt.description, { ...style(11), ...wrap }).setLineSpacing(3);
    return [bg, band, titleText, sub, desc];
  }

  private onLog({ lines }: GameEvents['log']): void {
    this.log.push(...lines);
    if (this.log.length > LOG_LINES) this.log.splice(0, this.log.length - LOG_LINES);
    this.logText.setText(this.log.join('\n'));
  }

  private onChoiceClosed(): void {
    this.choice?.destroy();
    this.choice = null;
  }

  private onRunEnded({ result, turns }: GameEvents['run-ended']): void {
    const won = result === 'won';
    this.overlayTitle
      .setText(won ? 'VICTORY' : 'YOU DIED')
      .setFontSize(36)
      .setColor(won ? TEXT_COLORS.ACCENT : '#c0392b');
    this.overlaySub.setText(`${turns} turnos  ·  Enter / A: nova run`);
    this.overlay.setVisible(true);
  }

  private updatePadStatus(): void {
    const total = this.input.gamepad?.total ?? 0;
    this.padText.setText(total > 0 ? 'Controle: conectado' : 'Controle: aperte um botão');
  }
}

function style(size: number, color: string = TEXT_COLORS.PRIMARY): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color };
}
