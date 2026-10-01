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
import { onGameEvent, offGameEvent, type GameEvents } from '../view/events';
import { bindRenderScale, layoutCamera } from '../view/scaling';

const LOG_LINES = 14;
const PANEL_W = MAP_VIEW.x - 32;
const LEFT_X = 16;
const RIGHT_X = MAP_VIEW.x + MAP_VIEW.width + 16;
const HP_BAR_W = PANEL_W - 24;

/**
 * HUD por cima do mundo, com câmera própria (não se mexe quando a câmera
 * do mapa seguir o player no Marco 2). Só exibe o que a GameScene manda.
 * Marco 3 substitui por HUD completo (equipamento, hotbar, mini-mapa).
 */
export class UIScene extends Phaser.Scene {
  private subtitle!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private hpFill!: Phaser.GameObjects.Rectangle;
  private statsText!: Phaser.GameObjects.Text;
  private clickText!: Phaser.GameObjects.Text;
  private padText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlaySub!: Phaser.GameObjects.Text;
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
      .text(GAME_WIDTH / 2, 56, 'Marco 1', style(12, TEXT_COLORS.MUTED))
      .setOrigin(0.5, 0);

    // --- painel esquerdo: status do Knight
    this.drawPanel(LEFT_X, 'KNIGHT');
    const y0 = MAP_VIEW.y + 32;
    this.hpText = this.add.text(LEFT_X + 12, y0, '', style(12));
    this.add.rectangle(LEFT_X + 12, y0 + 22, HP_BAR_W, 8, 0x000000).setOrigin(0);
    this.hpFill = this.add.rectangle(LEFT_X + 12, y0 + 22, HP_BAR_W, 8, COLORS.BLOOD_RED).setOrigin(0);
    this.statsText = this.add.text(LEFT_X + 12, y0 + 44, '', style(12)).setLineSpacing(6);
    this.clickText = this.add.text(LEFT_X + 12, MAP_VIEW.y + MAP_VIEW.height - 52, '', style(11, TEXT_COLORS.MUTED));
    this.padText = this.add.text(LEFT_X + 12, MAP_VIEW.y + MAP_VIEW.height - 32, '', style(11, TEXT_COLORS.MUTED));

    // --- painel direito: log de combate
    this.drawPanel(RIGHT_X, 'LOG');
    this.logText = this.add
      .text(RIGHT_X + 12, MAP_VIEW.y + 32, '', {
        ...style(11),
        wordWrap: { width: PANEL_W - 24 },
      })
      .setLineSpacing(4);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 28,
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
    onGameEvent(events, 'player-status', this.onPlayerStatus, this);
    onGameEvent(events, 'log', this.onLog, this);
    onGameEvent(events, 'run-ended', this.onRunEnded, this);
    onGameEvent(events, 'tile-clicked', this.onTileClicked, this);

    // HUD em coordenadas lógicas 960×540, desenhado na resolução real
    bindRenderScale(this, (scale) =>
      layoutCamera(this.cameras.main, scale, { x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT }),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offGameEvent(events, 'run-started', this.onRunStarted, this);
      offGameEvent(events, 'player-status', this.onPlayerStatus, this);
      offGameEvent(events, 'log', this.onLog, this);
      offGameEvent(events, 'run-ended', this.onRunEnded, this);
      offGameEvent(events, 'tile-clicked', this.onTileClicked, this);
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
    this.overlaySub = this.add.text(cx, cy + 24, '', style(12, TEXT_COLORS.PRIMARY)).setOrigin(0.5);
    this.overlay = this.add.container(0, 0, [shade, this.overlayTitle, this.overlaySub]).setVisible(false);
  }

  // ------------------------------------------------------------------ eventos

  private onRunStarted({ seed }: GameEvents['run-started']): void {
    this.subtitle.setText(`Marco 1  ·  seed ${seed}`);
    this.overlay.setVisible(false);
  }

  private onPlayerStatus({ hp, maxHp, atk, def, turn }: GameEvents['player-status']): void {
    this.hpText.setText(`HP ${hp}/${maxHp}`);
    this.hpFill.width = Math.round(HP_BAR_W * Math.max(0, hp / maxHp));
    this.statsText.setText(`ATK ${atk}\nDEF ${def}\nTurno ${turn}`);
  }

  private onLog({ lines }: GameEvents['log']): void {
    this.log.push(...lines);
    if (this.log.length > LOG_LINES) this.log.splice(0, this.log.length - LOG_LINES);
    this.logText.setText(this.log.join('\n'));
  }

  private onRunEnded({ result, turns }: GameEvents['run-ended']): void {
    const won = result === 'won';
    this.overlayTitle
      .setText(won ? 'VICTORY' : 'YOU DIED')
      .setColor(won ? TEXT_COLORS.ACCENT : '#c0392b');
    this.overlaySub.setText(`${turns} turnos  ·  Enter / A: nova run`);
    this.overlay.setVisible(true);
  }

  private onTileClicked({ tile }: GameEvents['tile-clicked']): void {
    this.clickText.setText(`Tile ${tile.x},${tile.y}`);
  }

  private updatePadStatus(): void {
    const total = this.input.gamepad?.total ?? 0;
    this.padText.setText(total > 0 ? 'Controle: conectado' : 'Controle: aperte um botão');
  }
}

function style(size: number, color: string = TEXT_COLORS.PRIMARY): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color };
}
