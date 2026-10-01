import Phaser from 'phaser';
import type { Entity } from '../core/entities/Entity';
import type { Point } from '../core/grid';
import { COLORS, FONT_FAMILY, TILE_SIZE } from '../config/display';

const BODY_SIZE = TILE_SIZE - 6;
const BAR_W = TILE_SIZE - 6;
const BAR_H = 3;

const BODY_COLORS = {
  player: COLORS.BLOOD_RED,
  enemy: COLORS.POISON_GREEN,
} as const;

/**
 * Desenho provisório de uma entidade: quadrado colorido + letra + barra de HP.
 * Só lê dados do core; nunca muda o estado do jogo.
 * No Marco 6 o quadrado vira sprite do Kenney, a interface continua a mesma.
 */
export class EntityView {
  readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly baseColor: number;

  constructor(
    private readonly scene: Phaser.Scene,
    entity: Entity,
  ) {
    this.baseColor = BODY_COLORS[entity.kind];

    this.body = scene.add.rectangle(0, 0, BODY_SIZE, BODY_SIZE, this.baseColor);
    const glyph = scene.add
      .text(0, 0, entity.glyph, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#f4ecd8',
      })
      .setOrigin(0.5);

    const barY = -TILE_SIZE / 2 + 1;
    const hpBack = scene.add.rectangle(-BAR_W / 2, barY, BAR_W, BAR_H, 0x000000).setOrigin(0, 0.5);
    this.hpFill = scene.add.rectangle(-BAR_W / 2, barY, BAR_W, BAR_H, COLORS.HP_GREEN).setOrigin(0, 0.5);

    this.container = scene.add.container(0, 0, [this.body, glyph, hpBack, this.hpFill]);
    this.setTile(entity.pos);
    this.setHp(entity.hp, entity.maxHp);
  }

  /** Posiciona no centro do tile (em coordenadas do mundo). */
  setTile(p: Point): void {
    this.container.setPosition(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2);
  }

  setHp(hp: number, maxHp: number): void {
    const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
    this.hpFill.width = Math.round(BAR_W * ratio);
    this.hpFill.fillColor = ratio > 0.5 ? COLORS.HP_GREEN : ratio > 0.25 ? COLORS.HP_YELLOW : COLORS.HP_RED;
  }

  /** Pisca branco ao levar dano. */
  flash(): void {
    this.body.fillColor = 0xffffff;
    this.scene.time.delayedCall(90, () => {
      if (this.body.active) this.body.fillColor = this.baseColor;
    });
  }

  destroy(): void {
    this.container.destroy();
  }

  /** Some aos poucos ao morrer. */
  die(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 350,
      ease: 'Quad.easeIn',
    });
  }
}
