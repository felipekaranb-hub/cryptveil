import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, MAP_VIEW, SCENE_KEYS, TEXT_COLORS } from '../config/display';
import type { InputSource } from '../input/InputController';
import { onGameEvent, offGameEvent, type GameEventName, type GameEvents } from '../view/events';
import { BattleLog } from '../view/hud/BattleLog';
import { ChoiceScreen } from '../view/hud/ChoiceScreen';
import { Hotbar } from '../view/hud/Hotbar';
import { InventoryScreen } from '../view/hud/InventoryScreen';
import { MiniMap } from '../view/hud/MiniMap';
import { StatusPanel } from '../view/hud/StatusPanel';
import { PANEL_H, PANEL_TOP, PANEL_W, RIGHT_X, textStyle } from '../view/hud/ui';
import { bindRenderScale, layoutCamera } from '../view/scaling';

const MILESTONE = 'Marco 4';
const BOSS_BAR_W = 360;

/**
 * HUD por cima do mundo, com câmera própria (não se mexe com a câmera do
 * mapa). Só desenha o que a GameScene manda por evento; nunca lê o RunState.
 * Painel esquerdo = Knight · direito = minimapa + LOG · embaixo = hotbar.
 */
export class UIScene extends Phaser.Scene {
  private subtitle!: Phaser.GameObjects.Text;
  private status!: StatusPanel;
  private hotbar!: Hotbar;
  private log!: BattleLog;
  private minimap!: MiniMap;
  private inventory!: InventoryScreen;
  private choice!: ChoiceScreen;
  private overlay!: Phaser.GameObjects.Container;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlaySub!: Phaser.GameObjects.Text;
  private source: InputSource = 'keyboard';
  private bossBar!: Phaser.GameObjects.Container;
  private bossName!: Phaser.GameObjects.Text;
  private bossFill!: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SCENE_KEYS.UI);
  }

  create(): void {
    // Moldura em volta do mapa
    this.add
      .rectangle(MAP_VIEW.x - 2, MAP_VIEW.y - 2, MAP_VIEW.width + 4, MAP_VIEW.height + 4)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.FRAME);

    this.add.text(GAME_WIDTH / 2, 22, 'CRYPTVEIL', textStyle(28, TEXT_COLORS.ACCENT)).setOrigin(0.5, 0);
    this.subtitle = this.add.text(GAME_WIDTH / 2, 56, MILESTONE, textStyle(12, TEXT_COLORS.MUTED)).setOrigin(0.5, 0);

    this.status = new StatusPanel(this);

    // Painel direito: minimapa em cima, LOG embaixo
    this.add.rectangle(RIGHT_X, PANEL_TOP, PANEL_W, PANEL_H, 0x111111).setOrigin(0).setStrokeStyle(1, COLORS.FRAME);
    this.minimap = new MiniMap(this, PANEL_TOP + 8);
    this.log = new BattleLog(this, PANEL_TOP + 16 + MiniMap.height, PANEL_TOP + PANEL_H - 8);

    this.createBossBar();
    this.hotbar = new Hotbar(this);
    this.inventory = new InventoryScreen(this);
    this.choice = new ChoiceScreen(this);
    this.createOverlay();

    this.updatePadStatus();
    this.input.gamepad?.on('connected', () => this.updatePadStatus());
    this.input.gamepad?.on('disconnected', () => this.updatePadStatus());

    this.listen('run-started', ({ seed }) => {
      this.subtitle.setText(`${MILESTONE}  ·  seed ${seed}`);
      this.overlay.setVisible(false);
    });
    this.listen('resume-offered', ({ seed, floor, turn }) => {
      this.subtitle.setText(`${MILESTONE}  ·  seed ${seed}`);
      this.overlayTitle.setText('RUN SUSPENSA').setColor(TEXT_COLORS.ACCENT).setFontSize(28);
      this.overlaySub.setText(`Andar ${floor}  ·  turno ${turn}\n\nEnter / A: continuar\nEsc / B: nova run`);
      this.overlay.setVisible(true);
    });
    this.listen('hud', (s) => {
      this.status.update(s);
      this.hotbar.update(s.hotbar);
    });
    this.listen('minimap', (m) => this.minimap.update(m));
    this.listen('boss-status', (b) => {
      this.bossBar.setVisible(b !== null);
      this.subtitle.setVisible(b === null);
      if (!b) return;
      this.bossName.setText(`${b.name.toUpperCase()}${b.enraged ? '  · ENFURECIDO' : ''}  ${b.hp}/${b.maxHp}`);
      this.bossFill.width = Math.round(BOSS_BAR_W * Math.max(0, b.hp / b.maxHp));
      this.bossFill.fillColor = b.enraged ? COLORS.BOSS_ENRAGED : COLORS.BOSS;
    });
    this.listen('log', ({ lines }) => this.log.push(lines));
    this.listen('input-source', ({ source }) => {
      this.source = source;
      this.hotbar.setSource(source);
    });
    this.listen('inventory-view', (view) => this.inventory.show(view, this.source));
    this.listen('inventory-closed', () => this.inventory.close());
    this.listen('choice-prompt', (prompt) => this.choice.show(prompt));
    this.listen('choice-closed', () => this.choice.close());
    this.listen('run-ended', ({ result, turns }) => {
      const won = result === 'won';
      this.inventory.close();
      this.overlayTitle
        .setText(won ? 'VICTORY' : 'YOU DIED')
        .setFontSize(36)
        .setColor(won ? TEXT_COLORS.ACCENT : '#c0392b');
      this.overlaySub.setText(`${turns} turnos  ·  Enter / A: nova run`);
      this.overlay.setVisible(true);
    });

    // HUD em coordenadas lógicas 960×540, desenhado na resolução real
    bindRenderScale(this, (scale) =>
      layoutCamera(this.cameras.main, scale, { x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT }),
    );
  }

  /** Escuta um evento da GameScene e larga sozinho quando a cena fecha. */
  private listen<K extends GameEventName>(name: K, handler: (payload: GameEvents[K]) => void): void {
    const events = this.game.events;
    onGameEvent(events, name, handler, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offGameEvent(events, name, handler, this));
  }

  /** Barra do boss entre o título e o mapa (no lugar do subtítulo enquanto a luta dura). */
  private createBossBar(): void {
    const x = GAME_WIDTH / 2 - BOSS_BAR_W / 2;
    const y = MAP_VIEW.y - 22;
    this.bossName = this.add.text(GAME_WIDTH / 2, y - 16, '', textStyle(11, TEXT_COLORS.ACCENT)).setOrigin(0.5, 0);
    const back = this.add.rectangle(x, y, BOSS_BAR_W, 8, 0x000000).setOrigin(0).setStrokeStyle(1, COLORS.FRAME);
    this.bossFill = this.add.rectangle(x, y, BOSS_BAR_W, 8, COLORS.BOSS).setOrigin(0);
    this.bossBar = this.add.container(0, 0, [back, this.bossFill, this.bossName]).setVisible(false);
  }

  private createOverlay(): void {
    const cx = MAP_VIEW.x + MAP_VIEW.width / 2;
    const cy = MAP_VIEW.y + MAP_VIEW.height / 2;
    const shade = this.add.rectangle(MAP_VIEW.x, MAP_VIEW.y, MAP_VIEW.width, MAP_VIEW.height, 0x000000, 0.72).setOrigin(0);
    this.overlayTitle = this.add.text(cx, cy - 18, '', textStyle(36)).setOrigin(0.5);
    this.overlaySub = this.add
      .text(cx, cy + 18, '', { ...textStyle(12, TEXT_COLORS.PRIMARY), align: 'center' })
      .setOrigin(0.5, 0);
    this.overlay = this.add.container(0, 0, [shade, this.overlayTitle, this.overlaySub]).setVisible(false).setDepth(70);
  }

  private updatePadStatus(): void {
    const total = this.input.gamepad?.total ?? 0;
    this.status.padText.setText(total > 0 ? 'Controle: conectado' : 'Controle: aperte um botão');
  }
}
