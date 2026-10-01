import Phaser from 'phaser';
import { describeAction } from '../core/actions';
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

const LOG_LINES = 5;

/**
 * HUD por cima do mundo. Tem câmera própria, que não se mexe quando
 * a câmera do mapa seguir o player (Marco 2).
 *
 * Marco 0: título, seed, moldura do mapa, painel de log das últimas
 * ações (embrião do BattleLog) e status do controle.
 */
export class UIScene extends Phaser.Scene {
  private subtitle!: Phaser.GameObjects.Text;
  private clickText!: Phaser.GameObjects.Text;
  private padText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private log: string[] = [];

  constructor() {
    super(SCENE_KEYS.UI);
  }

  create(): void {
    const style = (size: number, color: string = TEXT_COLORS.PRIMARY) => ({
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      color,
    });

    // Moldura em volta do mapa
    this.add
      .rectangle(MAP_VIEW.x - 2, MAP_VIEW.y - 2, MAP_VIEW.width + 4, MAP_VIEW.height + 4)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.FRAME);

    this.add.text(GAME_WIDTH / 2, 22, 'CRYPTVEIL', style(28, TEXT_COLORS.ACCENT)).setOrigin(0.5, 0);
    this.subtitle = this.add
      .text(GAME_WIDTH / 2, 56, 'Marco 0', style(12, TEXT_COLORS.MUTED))
      .setOrigin(0.5, 0);

    // Painéis laterais: reservam o espaço do HUD (Marco 3)
    const panelW = MAP_VIEW.x - 32;
    this.drawPanel(16, MAP_VIEW.y, panelW, MAP_VIEW.height, 'STATUS');
    this.drawPanel(MAP_VIEW.x + MAP_VIEW.width + 16, MAP_VIEW.y, panelW, MAP_VIEW.height, 'LOG');

    this.clickText = this.add.text(28, MAP_VIEW.y + 32, 'Clique num tile', style(12));
    this.padText = this.add.text(28, MAP_VIEW.y + 56, '', style(12, TEXT_COLORS.MUTED));
    this.logText = this.add
      .text(MAP_VIEW.x + MAP_VIEW.width + 28, MAP_VIEW.y + 32, '', style(12))
      .setLineSpacing(6);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 28,
        'WASD/Setas ou D-pad: mover  ·  1–8: skills  ·  I / Y: inventário  ·  Enter / A: confirmar',
        style(11, TEXT_COLORS.MUTED),
      )
      .setOrigin(0.5);

    this.updatePadStatus();
    this.input.gamepad?.on('connected', () => this.updatePadStatus());
    this.input.gamepad?.on('disconnected', () => this.updatePadStatus());

    const events = this.game.events;
    onGameEvent(events, 'run-started', this.onRunStarted, this);
    onGameEvent(events, 'tile-clicked', this.onTileClicked, this);
    onGameEvent(events, 'action', this.onAction, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offGameEvent(events, 'run-started', this.onRunStarted, this);
      offGameEvent(events, 'tile-clicked', this.onTileClicked, this);
      offGameEvent(events, 'action', this.onAction, this);
    });
  }

  private drawPanel(x: number, y: number, w: number, h: number, title: string): void {
    this.add.rectangle(x, y, w, h, 0x111111).setOrigin(0).setStrokeStyle(1, COLORS.FRAME);
    this.add.text(x + 12, y + 8, title, {
      fontFamily: FONT_FAMILY,
      fontSize: '11px',
      color: TEXT_COLORS.ACCENT,
    });
  }

  private onRunStarted({ seed }: GameEvents['run-started']): void {
    this.subtitle.setText(`Marco 0  ·  seed ${seed}`);
  }

  private onTileClicked({ tile }: GameEvents['tile-clicked']): void {
    this.clickText.setText(`Tile ${tile.x},${tile.y}`);
  }

  private onAction({ action, source }: GameEvents['action']): void {
    const icon = source === 'gamepad' ? '[pad]' : '[kb] ';
    this.log.push(`${icon} ${describeAction(action)}`);
    if (this.log.length > LOG_LINES) this.log.shift();
    this.logText.setText(this.log.join('\n'));
    this.updatePadStatus();
  }

  private updatePadStatus(): void {
    const total = this.input.gamepad?.total ?? 0;
    this.padText.setText(total > 0 ? 'Controle: conectado' : 'Controle: aperte um\nbotão pra detectar');
  }
}
