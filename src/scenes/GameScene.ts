import Phaser from 'phaser';
import type { Action } from '../core/actions';
import { getTile, TileType } from '../core/dungeon/DungeonMap';
import type { CoreEvent } from '../core/events';
import { getItem, type ItemId } from '../core/data/items';
import { DIRECTIONS, inBounds, step } from '../core/grid';
import { countInBag, xpToNextLevel } from '../core/hero';
import { randomSeed } from '../core/rng';
import { createRun, getEntity, getPlayer, type RunState } from '../core/run';
import { resolvePlayerAction } from '../core/turn/TurnManager';
import { COLORS, MAP_VIEW, POP_COLORS, SCENE_KEYS, TILE_COLORS, TILE_SIZE } from '../config/display';
import { InputController } from '../input/InputController';
import { clearRun, loadRun, saveRun } from '../storage/runStorage';
import { worldToTile } from '../view/coords';
import { EntityView } from '../view/EntityView';
import { emitGameEvent } from '../view/events';
import { formatEvent, formatFailure } from '../view/format';
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
  /** 'resume-offer': achou run suspensa e espera Continuar/Nova run. */
  private mode: 'playing' | 'resume-offer' = 'playing';
  private readonly views = new Map<string, EntityView>();
  private mapGraphics: Phaser.GameObjects.Graphics | null = null;
  /** Opção destacada no prompt da Training Room (0 = +ATK, 1 = +DEF). */
  private trainingChoice = 0;
  private controls!: InputController;
  private clickMarker!: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  init(data: GameSceneData): void {
    // Prioridade: seed passado no restart → ?seed= na URL → run suspensa → seed novo.
    // Seed na URL é pra reproduzir bug: ignora a run suspensa (ela fica guardada
    // até o próximo save desta run nova).
    const fromUrl = Number(new URLSearchParams(window.location.search).get('seed'));
    const urlSeed = Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : undefined;
    const suspended = data.seed === undefined && urlSeed === undefined ? loadRun() : null;

    this.mode = suspended ? 'resume-offer' : 'playing';
    this.state = suspended ?? createRun(data.seed ?? urlSeed ?? randomSeed());
    this.views.clear();
    this.mapGraphics = null;
    this.trainingChoice = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.BACKGROUND);

    this.clickMarker = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.HIGHLIGHT, 0.6)
      .setDepth(10)
      .setVisible(false);

    this.buildFloor();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointer, this);

    this.controls = new InputController(this);
    this.controls.onAction((action) => this.handleAction(action));

    // Câmera e textos acompanham a resolução real da tela
    bindRenderScale(this, (scale) => {
      layoutCamera(this.cameras.main, scale, MAP_VIEW);
      this.centerCamera();
    });

    // Suspender automático: aba escondida (celular troca de app, minimiza) salva a run
    const onVisibility = (): void => {
      if (document.hidden && this.mode === 'playing') saveRun(this.state);
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVisibility);
    });

    this.scene.launch(SCENE_KEYS.UI);
    // A UI precisa estar de pé antes de receber o estado inicial
    this.time.delayedCall(0, () => {
      const { seed, floor, turn } = this.state;
      if (this.mode === 'resume-offer') emitGameEvent(this.game.events, 'resume-offered', { seed, floor, turn });
      else this.startPlaying();
      this.emitPlayerStatus();
    });
  }

  override update(time: number): void {
    this.controls.update(time);
  }

  // ---------------------------------------------------------------- andar

  /** (Re)desenha o andar atual: mapa, entidades e limites da câmera. */
  private buildFloor(): void {
    for (const view of this.views.values()) view.destroy();
    this.views.clear();

    this.redrawMap();
    for (const entity of this.state.entities) {
      this.views.set(entity.id, new EntityView(this, entity));
    }
    this.clickMarker.setVisible(false);
    this.centerCamera();
  }

  /**
   * Câmera no player, presa às bordas do mapa. Feito à mão em vez de
   * startFollow/setBounds: com origin 0 e zoom = renderScale, o Phaser
   * calcula o centro com a largura FÍSICA do viewport e o player sai do meio.
   * Aqui tudo é em pixels lógicos: a área visível é sempre MAP_VIEW.
   */
  private centerCamera(): void {
    if (!this.state) return;
    const { map } = this.state;
    const p = getPlayer(this.state).pos;
    const clamp = (target: number, view: number, world: number): number =>
      world <= view ? (world - view) / 2 : Math.min(Math.max(target - view / 2, 0), world - view);
    this.cameras.main.setScroll(
      clamp(p.x * TILE_SIZE + TILE_SIZE / 2, MAP_VIEW.width, map.width * TILE_SIZE),
      clamp(p.y * TILE_SIZE + TILE_SIZE / 2, MAP_VIEW.height, map.height * TILE_SIZE),
    );
  }

  private redrawMap(): void {
    this.mapGraphics?.destroy();
    this.mapGraphics = this.drawMap();
  }

  private drawMap(): Phaser.GameObjects.Graphics {
    const { map } = this.state;
    const g = this.add.graphics();
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const p = { x, y };
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const tile = getTile(map, p);
        if (tile === TileType.WALL) {
          // Só desenha parede que encosta em chão; o resto é rocha (fundo)
          const touchesFloor = DIRECTIONS.some((d) => getTile(map, step(p, d)) !== TileType.WALL);
          if (!touchesFloor) continue;
          g.fillStyle(TILE_COLORS.WALL, 1);
          g.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          g.fillStyle(TILE_COLORS.WALL_EDGE, 1);
          g.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        } else if (tile === TileType.STAIRS) {
          g.fillStyle(TILE_COLORS.STAIRS, 1);
          g.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          // Degraus provisórios até os sprites do Marco 6
          g.fillStyle(TILE_COLORS.STAIRS_STEP, 1);
          for (let i = 0; i < 4; i++) g.fillRect(px + 4 + i * 3, py + 6 + i * 6, TILE_SIZE - 8 - i * 6, 3);
        } else if (tile === TileType.TRAINING) {
          // Altar de treino provisório: quadrado roxo com moldura dourada
          g.fillStyle(TILE_COLORS.TRAINING, 1);
          g.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          g.lineStyle(2, TILE_COLORS.TRAINING_MARK, 1);
          g.strokeRect(px + 5, py + 5, TILE_SIZE - 10, TILE_SIZE - 10);
          g.fillStyle(TILE_COLORS.TRAINING_MARK, 1);
          g.fillRect(px + 13, py + 9, 6, 14);
          g.fillRect(px + 9, py + 13, 14, 6);
        } else {
          const light = (x + y) % 2 === 0;
          g.fillStyle(light ? TILE_COLORS.FLOOR_LIGHT : TILE_COLORS.FLOOR_DARK, 1);
          g.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    return g.setDepth(-1);
  }

  // ------------------------------------------------------------------- turno

  private handleAction(action: Action): void {
    if (this.mode === 'resume-offer') {
      if (action.type === 'confirm') {
        this.mode = 'playing';
        this.startPlaying();
      } else if (action.type === 'cancel') {
        clearRun();
        this.restartRun();
      }
      return;
    }

    if (this.state.status !== 'playing') {
      // Fim de run: Enter / A começa outra com seed novo
      if (action.type === 'confirm') this.restartRun();
      return;
    }

    if (this.state.prompt === 'training') {
      this.handleTrainingInput(action);
      return;
    }

    const result = resolvePlayerAction(this.state, action);
    if (!result.tookTurn) {
      // Parede fica quieta; skill sem mana/alvo avisa no LOG
      const warning = formatFailure(result);
      if (warning) emitGameEvent(this.game.events, 'log', { lines: [warning] });
      return;
    }

    this.playEvents(result.events);
    this.emitPlayerStatus();
  }

  /** Training Room: ←/→ escolhe, Enter/A confirma. O core só recebe a escolha final. */
  private handleTrainingInput(action: Action): void {
    if (action.type === 'move' && (action.dir === 'W' || action.dir === 'E')) {
      this.trainingChoice = action.dir === 'W' ? 0 : 1;
      emitGameEvent(this.game.events, 'training-prompt', { selected: this.trainingChoice });
      return;
    }
    if (action.type !== 'confirm') return;
    const result = resolvePlayerAction(this.state, { type: 'choose', index: this.trainingChoice });
    this.playEvents(result.events);
    this.emitPlayerStatus();
  }

  /** Começa (ou retoma) o jogo: some o overlay e reabre um prompt pendente do save. */
  private startPlaying(): void {
    emitGameEvent(this.game.events, 'run-started', { seed: this.state.seed });
    if (this.state.prompt === 'training') this.openTrainingPrompt();
  }

  private openTrainingPrompt(): void {
    this.trainingChoice = 0;
    emitGameEvent(this.game.events, 'training-prompt', { selected: 0 });
  }

  /** Aplica os eventos do core na tela, na ordem. */
  private playEvents(events: readonly CoreEvent[]): void {
    const lines: string[] = [];
    // Vários números na mesma entidade no mesmo turno saem um depois do outro
    const pops = new Map<string, number>();
    const pop = (entityId: string, text: string, color: string): void => {
      const n = pops.get(entityId) ?? 0;
      pops.set(entityId, n + 1);
      this.views.get(entityId)?.popText(text, color, n * 140);
    };
    for (const event of events) {
      const line = formatEvent(event, this.state);
      if (line) lines.push(line);

      switch (event.type) {
        case 'moved':
          this.views.get(event.entityId)?.setTile(event.to);
          if (event.entityId === this.state.playerId) this.centerCamera();
          break;
        case 'attacked': {
          const target = getEntity(this.state, event.targetId);
          const view = this.views.get(event.targetId);
          if (target && view) {
            view.setHp(event.targetHp, target.maxHp);
            view.flash();
          }
          const onPlayer = event.targetId === this.state.playerId;
          pop(event.targetId, `-${event.damage}`, onPlayer ? POP_COLORS.DAMAGE_TAKEN : POP_COLORS.DAMAGE_DEALT);
          // Tremidinha só quando o player leva um golpe pesado (≥ 20% do HP max)
          if (onPlayer && target && event.damage >= target.maxHp * 0.2) this.cameras.main.shake(80, 0.004);
          break;
        }
        case 'died':
          this.views.get(event.entityId)?.die();
          break;
        case 'healed':
          this.views.get(event.entityId)?.setHp(event.hp, getEntity(this.state, event.entityId)?.maxHp ?? event.hp);
          if (event.source !== 'passive') this.views.get(event.entityId)?.flashHeal();
          pop(event.entityId, `+${event.amount}`, POP_COLORS.HEAL);
          break;
        case 'mana-restored':
          pop(this.state.playerId, `+${event.amount}`, POP_COLORS.MANA);
          break;
        case 'leveled-up': {
          const p = getPlayer(this.state);
          this.views.get(p.id)?.setHp(p.hp, p.maxHp);
          this.views.get(p.id)?.flashHeal();
          break;
        }
        case 'training-offered':
          this.openTrainingPrompt();
          break;
        case 'trained':
          this.redrawMap(); // o altar vira chão
          emitGameEvent(this.game.events, 'training-closed', {});
          break;
        case 'descended':
          // O core já trocou mapa e monstros: redesenha tudo e suspende a run
          this.buildFloor();
          this.cameras.main.fadeIn(250);
          saveRun(this.state);
          break;
        case 'victory':
        case 'defeat':
          // Roguelite: run acabada não tem "Continuar"
          clearRun();
          emitGameEvent(this.game.events, 'run-ended', {
            result: event.type === 'victory' ? 'won' : 'lost',
            turns: this.state.turn,
          });
          break;
        case 'waited':
        case 'skill-used':
        case 'stats-changed':
        case 'rewarded':
        case 'looted':
        case 'room-cleared':
          break;
      }
    }
    if (lines.length > 0) emitGameEvent(this.game.events, 'log', { lines });
  }

  private emitPlayerStatus(): void {
    const p = getPlayer(this.state);
    const { hero } = this.state;
    const itemName = (id: ItemId | undefined): string => (id ? getItem(id).name : '—');
    emitGameEvent(this.game.events, 'player-status', {
      hp: p.hp,
      maxHp: p.maxHp,
      mana: hero.mana,
      maxMana: hero.maxMana,
      atk: p.atk,
      def: p.def,
      level: hero.level,
      xp: hero.xp,
      xpNext: xpToNextLevel(hero.level),
      gold: hero.gold,
      turn: this.state.turn,
      floor: this.state.floor,
      potions: { hp: countInBag(hero, 'hpPotion'), mana: countInBag(hero, 'manaPotion') },
      gear: {
        weapon: itemName(hero.equipment.weapon),
        armor: itemName(hero.equipment.armor),
        helmet: itemName(hero.equipment.helmet),
        shield: itemName(hero.equipment.shield),
      },
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
