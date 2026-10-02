import Phaser from 'phaser';
import type { Entity } from '../core/entities/Entity';
import type { Point } from '../core/grid';
import { COLORS, FONT_FAMILY, MOVE_TWEEN_MS, TEXT_LETTER_SPACING, TILE_SIZE } from '../config/display';
import { ATLAS, BOSS_SCALE, ENTITY_FALLBACK_FRAME, ENTITY_FRAMES, SPRITE_SCALE, SPRITE_TINTS } from '../config/sprites';
import { getRenderScale } from './scaling';

const BAR_W = TILE_SIZE - 6;
const BAR_H = 3;

/**
 * Desenho de uma entidade: sprite do atlas + barra de HP. Só lê dados do
 * core; nunca muda o estado do jogo. Andar é animado (MOVE_TWEEN_MS), mas o
 * core já está no tile novo: a animação é só apresentação.
 */
export class EntityView {
  readonly container: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private baseTint: number = SPRITE_TINTS.entity;
  private moveTween: Phaser.Tweens.Tween | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    entity: Entity,
  ) {
    const scale = SPRITE_SCALE * (entity.boss ? BOSS_SCALE : 1);
    this.sprite = scene.add
      .image(0, 0, ATLAS.key, ENTITY_FRAMES[entity.name] ?? ENTITY_FALLBACK_FRAME)
      .setScale(scale)
      // Boss maior cresce pra cima: os pés continuam no tile
      .setOrigin(0.5, entity.boss ? 0.6 : 0.5);
    if (entity.enraged) this.baseTint = SPRITE_TINTS.enraged;
    this.sprite.setTint(this.baseTint);

    const barY = -TILE_SIZE / 2 - (entity.boss ? 6 : 1);
    const hpBack = scene.add.rectangle(-BAR_W / 2, barY, BAR_W, BAR_H, 0x000000).setOrigin(0, 0.5);
    this.hpFill = scene.add.rectangle(-BAR_W / 2, barY, BAR_W, BAR_H, COLORS.HP_GREEN).setOrigin(0, 0.5);

    this.container = scene.add.container(0, 0, [this.sprite, hpBack, this.hpFill]);
    this.setTile(entity.pos, false);
    this.setHp(entity.hp, entity.maxHp);
  }

  /**
   * Vai pro centro do tile (coordenadas do mundo). Com `animate`, desliza
   * em MOVE_TWEEN_MS e vira o sprite pro lado em que andou.
   */
  setTile(p: Point, animate = true): void {
    const x = p.x * TILE_SIZE + TILE_SIZE / 2;
    const y = p.y * TILE_SIZE + TILE_SIZE / 2;
    this.moveTween?.stop();
    this.moveTween = null;
    if (x !== this.container.x) this.sprite.setFlipX(x < this.container.x);
    if (!animate) {
      this.container.setPosition(x, y);
      return;
    }
    this.moveTween = this.scene.tweens.add({
      targets: this.container,
      x,
      y,
      duration: MOVE_TWEEN_MS,
      ease: 'Sine.easeOut',
    });
  }

  /** Vira pro alvo sem sair do lugar (ataque, arremesso). */
  faceTowards(p: Point): void {
    const x = p.x * TILE_SIZE + TILE_SIZE / 2;
    if (x !== this.container.x) this.sprite.setFlipX(x < this.container.x);
  }

  setHp(hp: number, maxHp: number): void {
    const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
    this.hpFill.width = Math.round(BAR_W * ratio);
    this.hpFill.fillColor = ratio > 0.5 ? COLORS.HP_GREEN : ratio > 0.25 ? COLORS.HP_YELLOW : COLORS.HP_RED;
  }

  /**
   * Número flutuante saindo de cima da entidade (dano, cura). `delayMs`
   * escalona vários números no mesmo turno pra não ficarem empilhados.
   */
  popText(text: string, color: string, delayMs = 0): void {
    const x = this.container.x;
    const y = this.container.y - TILE_SIZE / 2;
    const label = this.scene.add
      .text(x, y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: '20px',
        letterSpacing: TEXT_LETTER_SPACING,
        color,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(20)
      .setAlpha(0)
      // Criado depois do create(): precisa da resolução atual (handoff §4.4)
      .setResolution(getRenderScale());
    this.scene.tweens.add({
      targets: label,
      delay: delayMs,
      y: y - 20,
      alpha: { from: 1, to: 0 },
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  /** Boss enfurecido: sprite avermelhado. */
  setEnraged(): void {
    this.baseTint = SPRITE_TINTS.enraged;
    this.sprite.setTint(this.baseTint);
  }

  /** Pisca verde ao curar. */
  flashHeal(): void {
    this.flashColor(COLORS.HP_GREEN);
  }

  /** Pisca branco ao levar dano. */
  flash(): void {
    this.flashColor(0xffffff);
  }

  private flashColor(color: number): void {
    this.sprite.setTint(color).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(90, () => {
      if (this.sprite.active) this.sprite.setTint(this.baseTint).setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }

  destroy(): void {
    this.moveTween?.stop();
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
