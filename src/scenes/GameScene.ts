import Phaser from 'phaser';
import type { Action } from '../core/actions';
import { inBounds, step, type Point } from '../core/grid';
import { Rng, randomSeed } from '../core/rng';
import {
  COLORS,
  FONT_FAMILY,
  MAP_VIEW,
  SCENE_KEYS,
  TEXT_COLORS,
  TILE_COLORS,
  TILE_SIZE,
  VIEWPORT_H,
  VIEWPORT_W,
} from '../config/display';
import { InputController, type InputSource } from '../input/InputController';
import { worldToTile } from '../view/coords';
import { emitGameEvent } from '../view/events';

/**
 * Cena do MUNDO: só desenha o mapa e recebe input.
 * O HUD fica na UIScene, rodando em paralelo por cima.
 *
 * Marco 0: grid 15×11 em xadrez, cantos marcados, clique e cursor de teste.
 * No Marco 1 o xadrez vira o DungeonMap e o cursor vira o Knight.
 */
export class GameScene extends Phaser.Scene {
  private seed = 0;
  /** RNG da run. Vai pro estado do core no Marco 1. */
  rng!: Rng;

  private controls!: InputController;
  private clickMarker!: Phaser.GameObjects.Rectangle;
  private cursor!: Phaser.GameObjects.Rectangle;
  private cursorTile: Point = { x: 7, y: 5 };

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  init(): void {
    // ?seed=48213 na URL reproduz uma run; sem isso, seed novo
    const fromUrl = Number(new URLSearchParams(window.location.search).get('seed'));
    this.seed = Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : randomSeed();
    this.rng = Rng.fromSeed(this.seed);
  }

  create(): void {
    this.setupCamera();
    this.drawCheckerboard();
    this.drawCornerLabels();

    this.clickMarker = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.HIGHLIGHT)
      .setVisible(false);

    this.cursor = this.add
      .rectangle(0, 0, TILE_SIZE - 8, TILE_SIZE - 8, COLORS.BLOOD_RED)
      .setOrigin(0);
    this.placeCursor();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointer, this);

    this.controls = new InputController(this);
    this.controls.onAction((action, source) => this.handleAction(action, source));

    this.scene.launch(SCENE_KEYS.UI);
    // A UI precisa estar de pé antes de ouvir o seed
    this.time.delayedCall(0, () => emitGameEvent(this.game.events, 'run-started', { seed: this.seed }));
  }

  override update(time: number): void {
    this.controls.update(time);
  }

  // ------------------------------------------------------------------ câmera

  private setupCamera(): void {
    const cam = this.cameras.main;
    // A câmera do mundo só ocupa o retângulo do mapa; o resto da tela é do HUD
    cam.setViewport(MAP_VIEW.x, MAP_VIEW.y, MAP_VIEW.width, MAP_VIEW.height);
    cam.setBackgroundColor(TILE_COLORS.WALL);
    cam.setScroll(0, 0);
    // Marco 2: cam.startFollow(player) + cam.setBounds(0, 0, mapW, mapH)
  }

  // ---------------------------------------------------------------- desenho

  private drawCheckerboard(): void {
    const g = this.add.graphics();
    for (let y = 0; y < VIEWPORT_H; y++) {
      for (let x = 0; x < VIEWPORT_W; x++) {
        const light = (x + y) % 2 === 0;
        g.fillStyle(light ? TILE_COLORS.FLOOR_LIGHT : TILE_COLORS.FLOOR_DARK, 1);
        g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private drawCornerLabels(): void {
    const corners: Point[] = [
      { x: 0, y: 0 },
      { x: VIEWPORT_W - 1, y: 0 },
      { x: 0, y: VIEWPORT_H - 1 },
      { x: VIEWPORT_W - 1, y: VIEWPORT_H - 1 },
    ];
    for (const c of corners) {
      this.add
        .text(c.x * TILE_SIZE + TILE_SIZE / 2, c.y * TILE_SIZE + TILE_SIZE / 2, `${c.x},${c.y}`, {
          fontFamily: FONT_FAMILY,
          fontSize: '10px',
          color: TEXT_COLORS.ACCENT,
        })
        .setOrigin(0.5);
    }
  }

  private placeCursor(): void {
    this.cursor.setPosition(this.cursorTile.x * TILE_SIZE + 4, this.cursorTile.y * TILE_SIZE + 4);
  }

  // ------------------------------------------------------------------- input

  private handlePointer(pointer: Phaser.Input.Pointer): void {
    // pointer.x/y estão em coordenadas do jogo (960×540), já descontado o zoom
    const insideMap =
      pointer.x >= MAP_VIEW.x &&
      pointer.x < MAP_VIEW.x + MAP_VIEW.width &&
      pointer.y >= MAP_VIEW.y &&
      pointer.y < MAP_VIEW.y + MAP_VIEW.height;
    if (!insideMap) return;

    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const tile = worldToTile(world.x, world.y);
    if (!inBounds(tile, VIEWPORT_W, VIEWPORT_H)) return;

    this.clickMarker.setPosition(tile.x * TILE_SIZE, tile.y * TILE_SIZE).setVisible(true);
    console.log(`[Cryptveil] tile ${tile.x},${tile.y}`);
    emitGameEvent(this.game.events, 'tile-clicked', { tile });
  }

  private handleAction(action: Action, source: InputSource): void {
    emitGameEvent(this.game.events, 'action', { action, source });

    // Teste de input do Marco 0: o quadrado vermelho anda pelo grid.
    // Bater na borda não faz nada (mesma regra da parede, handoff §2.10).
    if (action.type === 'move') {
      const next = step(this.cursorTile, action.dir);
      if (inBounds(next, VIEWPORT_W, VIEWPORT_H)) {
        this.cursorTile = next;
        this.placeCursor();
      }
    }
  }
}
