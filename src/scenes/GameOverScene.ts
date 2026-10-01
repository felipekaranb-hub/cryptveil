import Phaser from 'phaser';
import type { RunSummary } from '../core/meta/metaProgress';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS, TEXT_COLORS } from '../config/display';
import { InputController } from '../input/InputController';
import { textStyle } from '../view/hud/ui';
import { bindRenderScale, layoutCamera } from '../view/scaling';

/**
 * Fim da run (Marco 5): resumo e quanto do gold foi pro Sanctum. A meta já
 * foi salva quando a run acabou; aqui é só leitura. Enter/A volta pro Sanctum.
 */
export class GameOverScene extends Phaser.Scene {
  private summary!: RunSummary;
  private controls!: InputController;

  constructor() {
    super(SCENE_KEYS.GAME_OVER);
  }

  init(summary: RunSummary): void {
    this.summary = summary;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.BACKGROUND);
    const s = this.summary;
    const won = s.outcome === 'won';
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 60, won ? 'VICTORY' : 'YOU DIED', textStyle(40, won ? TEXT_COLORS.ACCENT : '#c0392b'))
      .setOrigin(0.5, 0);
    this.add
      .text(
        cx,
        116,
        `Andar ${s.floor}  ·  nível ${s.level}  ·  ${s.turns} turno${s.turns === 1 ? '' : 's'}  ·  seed ${s.seed}`,
        textStyle(13, TEXT_COLORS.MUTED),
      )
      .setOrigin(0.5, 0);

    const killsText =
      s.kills.length > 0 ? s.kills.map((k) => `${k.name} ×${k.count}`).join('   ') : 'Nenhuma';
    this.add.text(cx, 170, 'KILLS', textStyle(13, TEXT_COLORS.ACCENT)).setOrigin(0.5, 0);
    this.add
      .text(cx, 192, killsText, { ...textStyle(13), align: 'center', wordWrap: { width: 640 } })
      .setOrigin(0.5, 0);

    const pct = Math.round(s.rate * 100);
    this.add.text(cx, 260, 'GOLD', textStyle(13, TEXT_COLORS.ACCENT)).setOrigin(0.5, 0);
    this.add
      .text(
        cx,
        282,
        `Sobrou ${s.goldLeft}g  →  ${pct}% ${won ? '(vitória)' : '(morte)'}  →  +${s.converted}g no Sanctum`,
        textStyle(15),
      )
      .setOrigin(0.5, 0);
    this.add.text(cx, 310, `Gold guardado: ${s.metaGold}`, textStyle(13, TEXT_COLORS.MUTED)).setOrigin(0.5, 0);

    this.add
      .text(cx, GAME_HEIGHT - 60, 'Enter / A: voltar ao Sanctum', textStyle(12, TEXT_COLORS.MUTED))
      .setOrigin(0.5, 0);

    this.controls = new InputController(this);
    this.controls.onAction((action) => {
      if (action.type === 'confirm') this.scene.start(SCENE_KEYS.HUB);
    });
    bindRenderScale(this, (scale) =>
      layoutCamera(this.cameras.main, scale, { x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT }),
    );
  }

  override update(time: number): void {
    this.controls.update(time);
  }
}
