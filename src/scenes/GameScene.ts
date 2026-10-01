import Phaser from 'phaser';
import type { Action } from '../core/actions';
import { getTile, TileType } from '../core/dungeon/DungeonMap';
import type { CoreEvent } from '../core/events';
import { inBounds } from '../core/grid';
import { randomSeed } from '../core/rng';
import { createTestRun, getEntity, getPlayer, type RunState } from '../core/run';
import { resolvePlayerAction } from '../core/turn/TurnManager';
import { COLORS, MAP_VIEW, SCENE_KEYS, TILE_COLORS, TILE_SIZE } from '../config/display';
import { InputController } from '../input/InputController';
import { worldToTile } from '../view/coords';
import { EntityView } from '../view/EntityView';
import { emitGameEvent } from '../view/events';
import { formatEvent } from '../view/format';
import { bindRenderScale, layoutCamera } from '../view/scaling';

interface GameSceneData {
  seed?: number;
}

/**
 * Cena do MUNDO. Segura o RunState, manda as ações pro core e anima os
 * eventos que voltam. Não decide nada de regra: isso é do TurnManager.
 * O HUD fica na UIScene, rodando em paralelo por cima.
 */
export class GameScene extends Phaser.Scene {
  private state!: RunState;
  private readonly views = new Map<string, EntityView>();
  private controls!: InputController;
  private clickMarker!: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  init(data: GameSceneData): void {
    // Prioridade: seed passado no restart → ?seed= na URL → seed novo
    const fromUrl = Number(new URLSearchParams(window.location.search).get('seed'));
    const seed =
      data.seed ?? (Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : randomSeed());
    this.state = createTestRun(seed);
    this.views.clear();
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.BACKGROUND);
    this.drawMap();

    for (const entity of this.state.entities) {
      this.views.set(entity.id, new EntityView(this, entity));
    }

    this.clickMarker = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.HIGHLIGHT, 0.6)
      .setVisible(false);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointer, this);

    this.controls = new InputController(this);
    this.controls.onAction((action) => this.handleAction(action));

    // Câmera e textos acompanham a resolução real da tela
    bindRenderScale(this, (scale) => this.layoutCamera(scale));

    this.scene.launch(SCENE_KEYS.UI);
    // A UI precisa estar de pé antes de receber o estado inicial
    this.time.delayedCall(0, () => {
      emitGameEvent(this.game.events, 'run-started', { seed: this.state.seed });
      this.emitPlayerStatus();
    });
  }

  override update(time: number): void {
    this.controls.update(time);
  }

  // ------------------------------------------------------------------ câmera

  private layoutCamera(scale: number): void {
    // A câmera do mundo só ocupa o retângulo do mapa; o resto da tela é do HUD
    layoutCamera(this.cameras.main, scale, MAP_VIEW);
    this.cameras.main.setScroll(0, 0);
    // Marco 2: cam.startFollow(player) + cam.setBounds(0, 0, mapW, mapH)
  }

  // ---------------------------------------------------------------- desenho

  private drawMap(): void {
    const { map } = this.state;
    const g = this.add.graphics();
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        if (getTile(map, { x, y }) === TileType.WALL) {
          g.fillStyle(TILE_COLORS.WALL, 1);
          g.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          g.fillStyle(TILE_COLORS.WALL_EDGE, 1);
          g.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        } else {
          const light = (x + y) % 2 === 0;
          g.fillStyle(light ? TILE_COLORS.FLOOR_LIGHT : TILE_COLORS.FLOOR_DARK, 1);
          g.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  // ------------------------------------------------------------------- turno

  private handleAction(action: Action): void {
    if (this.state.status !== 'playing') {
      // Fim de run: Enter / A começa outra com seed novo
      if (action.type === 'confirm') this.restartRun();
      return;
    }

    const result = resolvePlayerAction(this.state, action);
    if (!result.tookTurn) return; // parede, ação sem efeito: nada muda

    this.playEvents(result.events);
    this.emitPlayerStatus();
  }

  /** Aplica os eventos do core na tela, na ordem. */
  private playEvents(events: readonly CoreEvent[]): void {
    const lines: string[] = [];
    for (const event of events) {
      const line = formatEvent(event, this.state);
      if (line) lines.push(line);

      switch (event.type) {
        case 'moved':
          this.views.get(event.entityId)?.setTile(event.to);
          break;
        case 'attacked': {
          const target = getEntity(this.state, event.targetId);
          const view = this.views.get(event.targetId);
          if (target && view) {
            view.setHp(event.targetHp, target.maxHp);
            view.flash();
          }
          if (event.damage >= 8) this.cameras.main.shake(80, 0.004);
          break;
        }
        case 'died':
          this.views.get(event.entityId)?.die();
          break;
        case 'victory':
        case 'defeat':
          emitGameEvent(this.game.events, 'run-ended', {
            result: event.type === 'victory' ? 'won' : 'lost',
            turns: this.state.turn,
          });
          break;
        case 'waited':
          break;
      }
    }
    if (lines.length > 0) emitGameEvent(this.game.events, 'log', { lines });
  }

  private emitPlayerStatus(): void {
    const p = getPlayer(this.state);
    emitGameEvent(this.game.events, 'player-status', {
      hp: p.hp,
      maxHp: p.maxHp,
      atk: p.atk,
      def: p.def,
      turn: this.state.turn,
    });
  }

  private restartRun(): void {
    this.scene.stop(SCENE_KEYS.UI);
    this.scene.restart({ seed: randomSeed() } satisfies GameSceneData);
  }

  // ------------------------------------------------------------------- input

  private handlePointer(pointer: Phaser.Input.Pointer): void {
    // pointer.x/y estão em pixels do canvas; o viewport da câmera também
    const cam = this.cameras.main;
    const insideMap =
      pointer.x >= cam.x &&
      pointer.x < cam.x + cam.width &&
      pointer.y >= cam.y &&
      pointer.y < cam.y + cam.height;
    if (!insideMap) return;

    const world = cam.getWorldPoint(pointer.x, pointer.y);
    const tile = worldToTile(world.x, world.y);
    if (!inBounds(tile, this.state.map.width, this.state.map.height)) return;

    this.clickMarker.setPosition(tile.x * TILE_SIZE, tile.y * TILE_SIZE).setVisible(true);
    emitGameEvent(this.game.events, 'tile-clicked', { tile });
  }
}
