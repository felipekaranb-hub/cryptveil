import Phaser from 'phaser';
import type { Action } from '../core/actions';
import { getTile, TileType } from '../core/dungeon/DungeonMap';
import type { CoreEvent } from '../core/events';
import type { ItemId } from '../core/data/items';
import { visibleTiles } from '../core/fog';
import { DIRECTIONS, inBounds, step } from '../core/grid';
import { randomSeed } from '../core/rng';
import { createRun, getEntity, getPlayer, type RunState } from '../core/run';
import { resolvePlayerAction } from '../core/turn/TurnManager';
import { COLORS, FOG, MAP_VIEW, POP_COLORS, SCENE_KEYS, TILE_SIZE } from '../config/display';
import { ATLAS, SPRITE_SCALE, SPRITE_TINTS, TILE_FRAMES } from '../config/sprites';
import { InputController, type InputSource } from '../input/InputController';
import { clearRun, loadRun, saveRun } from '../storage/runStorage';
import { closeRun, loadMeta } from '../storage/metaStorage';
import { runBonuses, type RunSummary } from '../core/meta/metaProgress';
import { worldToTile } from '../view/coords';
import { EntityView } from '../view/EntityView';
import { emitGameEvent } from '../view/events';
import { describeCard, describeTraining, formatEvent, formatFailure, type LogLine } from '../view/format';
import {
  buildHud,
  buildInventoryRows,
  buildMinimap,
  buildShopRows,
  INVENTORY_TABS,
  SHOP_TABS,
  type InventoryRow,
} from '../view/hud/model';
import { bindRenderScale, layoutCamera } from '../view/scaling';
import { playSfx, toggleMute } from '../view/audio/sfx';

/** Como a GameScene começa: run nova com esse seed, ou a run suspensa (resume). */
export interface GameSceneData {
  seed?: number;
  resume?: boolean;
}

/**
 * Cena do MUNDO. Segura o RunState, manda as ações pro core e anima os
 * eventos que voltam. Não decide nada de regra: isso é do TurnManager.
 * O HUD fica na UIScene, rodando em paralelo por cima.
 */
export class GameScene extends Phaser.Scene {
  private state!: RunState;
  /** 'inventory': tela de inventário aberta (I / Y); o mapa não recebe movimento. */
  private mode: 'playing' | 'inventory' = 'playing';
  /** Resumo da run que acabou (a meta já foi salva); Enter/A leva pra GameOverScene. */
  private summary: RunSummary | null = null;
  /** Painel aberto no modo 'inventory': inventário (I/Y) ou loja do mercador (prompt do core). */
  private panel: 'inventory' | 'shop' = 'inventory';
  /** Loja: pergunta "vender todos ou 1?" aberta sobre uma pilha (0 = todos, 1 = só 1). */
  private sellConfirm: { itemId: ItemId; name: string; count: number; unitPrice: number; choice: number } | null = null;
  /** Aba e linha selecionadas no painel. */
  private invTab = 0;
  private invSelected = 0;
  /** Tiles que o Knight vê agora (fog of war); recalculado a cada turno. */
  private visible: ReadonlySet<number> = new Set();
  private fogGraphics: Phaser.GameObjects.Graphics | null = null;
  /** O boss já apareceu na tela: a barra dele continua mesmo se sair da visão. */
  private bossSeen = false;
  private inputSource: InputSource = 'keyboard';
  /** Monstros que arremessaram neste turno: aparecem mesmo fora da visão. */
  private readonly revealedThisTurn = new Set<string>();
  private readonly views = new Map<string, EntityView>();
  private mapGraphics: Phaser.GameObjects.Container | null = null;
  /** Opção destacada na escolha aberta (carta ou Training Room). */
  private choice = 0;
  private controls!: InputController;
  private clickMarker!: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  init(data: GameSceneData): void {
    // Quem decide é o Sanctum (Continuar / Descer) ou o ?seed= da URL (BootScene).
    // Run nova já nasce com os upgrades comprados no Sanctum.
    const suspended = data.resume ? loadRun() : null;
    this.mode = 'playing';
    this.summary = null;
    this.state = suspended ?? createRun(data.seed ?? randomSeed(), runBonuses(loadMeta()));
    this.views.clear();
    this.mapGraphics = null;
    this.fogGraphics = null;
    this.choice = 0;
    this.invTab = 0;
    this.invSelected = 0;
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
    this.controls.onAction((action, source) => {
      if (source !== this.inputSource) {
        this.inputSource = source;
        emitGameEvent(this.game.events, 'input-source', { source });
      }
      this.handleAction(action);
    });

    // Câmera e textos acompanham a resolução real da tela
    bindRenderScale(this, (scale) => {
      layoutCamera(this.cameras.main, scale, MAP_VIEW);
      this.centerCamera();
    });

    // Suspender automático: aba escondida (celular troca de app, minimiza) salva a run
    const onVisibility = (): void => {
      if (document.hidden) saveRun(this.state);
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVisibility);
    });

    this.scene.launch(SCENE_KEYS.UI);
    // A UI precisa estar de pé antes de receber o estado inicial
    this.time.delayedCall(0, () => {
      this.startPlaying();
      this.refreshView();
    });
  }

  override update(time: number): void {
    this.controls.update(time);
    this.centerCamera();
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
    this.refreshView();
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
    // Segue a view (que anima o passo); sem view ainda, o tile do core
    const view = this.views.get(this.state.playerId)?.container;
    const tile = getPlayer(this.state).pos;
    const cx = view ? view.x : tile.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = view ? view.y : tile.y * TILE_SIZE + TILE_SIZE / 2;
    const clamp = (target: number, view: number, world: number): number =>
      world <= view ? (world - view) / 2 : Math.min(Math.max(target - view / 2, 0), world - view);
    this.cameras.main.setScroll(
      clamp(cx, MAP_VIEW.width, map.width * TILE_SIZE),
      clamp(cy, MAP_VIEW.height, map.height * TILE_SIZE),
    );
  }

  private redrawMap(): void {
    this.mapGraphics?.destroy();
    this.mapGraphics = this.drawMap();
  }

  /**
   * Andar com os sprites do atlas (Marco 6b). Parede só aparece onde encosta
   * em chão: com chão logo abaixo é a face de tijolo, senão o topo escuro com
   * uma borda de pedra do lado do chão (desenhada em código, sem autotile).
   */
  private drawMap(): Phaser.GameObjects.Container {
    const { map } = this.state;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const rim = this.add.graphics();
    const img = (frame: number, x: number, y: number, tint: number): void => {
      parts.push(
        this.add
          .image(x * TILE_SIZE, y * TILE_SIZE, ATLAS.key, frame)
          .setOrigin(0)
          .setScale(SPRITE_SCALE)
          .setTint(tint),
      );
    };
    const floorFrame = (x: number, y: number): number => {
      const variants = TILE_FRAMES.floor;
      return variants[(x * 7 + y * 13 + ((x * y) % 5)) % variants.length] as number;
    };
    const isWall = (p: { x: number; y: number }): boolean => getTile(map, p) === TileType.WALL;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const p = { x, y };
        const tile = getTile(map, p);
        if (tile === TileType.WALL) {
          const touchesFloor = DIRECTIONS.some((d) => !isWall(step(p, d)));
          if (!touchesFloor) continue;
          if (!isWall(step(p, 'S'))) {
            img(TILE_FRAMES.wallFace, x, y, SPRITE_TINTS.wall);
          } else {
            img(TILE_FRAMES.wallTop, x, y, SPRITE_TINTS.wall);
            // Borda de pedra nos lados que dão pra chão (o topo de baixo vira face)
            rim.fillStyle(SPRITE_TINTS.wallRim, 1);
            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;
            if (!isWall(step(p, 'N'))) rim.fillRect(px, py, TILE_SIZE, 4);
            if (!isWall(step(p, 'W'))) rim.fillRect(px, py, 4, TILE_SIZE);
            if (!isWall(step(p, 'E'))) rim.fillRect(px + TILE_SIZE - 4, py, 4, TILE_SIZE);
          }
          continue;
        }
        img(floorFrame(x, y), x, y, SPRITE_TINTS.floor);
        if (tile === TileType.STAIRS) img(TILE_FRAMES.stairs, x, y, SPRITE_TINTS.object);
        else if (tile === TileType.TRAINING) img(TILE_FRAMES.training, x, y, SPRITE_TINTS.object);
        else if (tile === TileType.MERCHANT) img(TILE_FRAMES.merchant, x, y, SPRITE_TINTS.object);
      }
    }
    parts.push(rim);
    return this.add.container(0, 0, parts).setDepth(-1);
  }

  // ------------------------------------------------------------------- turno

  private handleAction(action: Action): void {
    if (action.type === 'mute') {
      const muted = toggleMute();
      emitGameEvent(this.game.events, 'log', { lines: [{ text: muted ? 'Som desligado (M / Select)' : 'Som ligado', tone: 'muted' }] });
      return;
    }
    if (this.mode === 'inventory') {
      this.handleInventoryInput(action);
      return;
    }
    if (this.state.status !== 'playing') {
      // Fim de run: Enter / A vai pro resumo (a meta já foi salva na hora da morte/vitória)
      if (action.type === 'confirm' && this.summary) this.showGameOver(this.summary);
      return;
    }

    if (this.state.prompt?.type === 'shop') {
      // Loja aberta mas painel fechado (não deveria acontecer): reabre
      this.openPanel('shop');
      return;
    }
    if (this.state.prompt) {
      this.handleChoiceInput(action);
      return;
    }

    if (action.type === 'inventory') {
      this.openInventory();
      return;
    }
    this.act(action);
  }

  /** Manda a ação pro core e anima. Devolve se gastou o turno. */
  private act(action: Action): boolean {
    const result = resolvePlayerAction(this.state, action);
    if (!result.tookTurn && result.reason === 'free-action') {
      // Loja: comprar/vender mudam o estado sem gastar turno
      this.playEvents(result.events);
      this.refreshView();
      return false;
    }
    if (!result.tookTurn) {
      // Parede fica quieta; skill sem mana/alvo avisa no LOG
      const warning = formatFailure(result);
      if (warning) {
        playSfx('uiDeny');
        emitGameEvent(this.game.events, 'log', { lines: [{ text: warning, tone: 'muted' }] });
      }
      return false;
    }
    this.playEvents(result.events);
    this.refreshView();
    return true;
  }

  // -------------------------------------------------------------- inventário

  private openInventory(): void {
    this.openPanel('inventory');
  }

  private openPanel(panel: 'inventory' | 'shop'): void {
    this.mode = 'inventory';
    this.sellConfirm = null;
    this.panel = panel;
    this.invTab = 0;
    this.invSelected = this.firstSelectable(this.inventoryRows(), 0, 1);
    this.emitInventory();
  }

  private closeInventory(): void {
    this.mode = 'playing';
    emitGameEvent(this.game.events, 'inventory-closed', {});
  }

  private panelTabs(): readonly string[] {
    return this.panel === 'shop' ? SHOP_TABS : INVENTORY_TABS;
  }

  private inventoryRows(): InventoryRow[] {
    return this.panel === 'shop' ? buildShopRows(this.state, this.invTab) : buildInventoryRows(this.state, this.invTab);
  }

  /** Próxima linha selecionável a partir de `from` (pula títulos de seção); -1 se não tem. */
  private firstSelectable(rows: readonly InventoryRow[], from: number, dir: 1 | -1): number {
    for (let i = from; i >= 0 && i < rows.length; i += dir) if (!rows[i]?.header) return i;
    return -1;
  }

  private emitInventory(): void {
    const rows = this.inventoryRows();
    emitGameEvent(this.game.events, 'inventory-view', {
      tab: this.invTab,
      tabs: this.panelTabs(),
      rows,
      selected: this.invSelected,
      ...(this.panel === 'shop' ? { status: `Seu gold: ${this.state.hero.gold}` } : {}),
      ...(this.sellConfirm
        ? {
            confirm: {
              title: `Vender ${this.sellConfirm.name}?`,
              options: [
                `Todos ×${this.sellConfirm.count} (+${this.sellConfirm.unitPrice * this.sellConfirm.count}g)`,
                `Só 1 (+${this.sellConfirm.unitPrice}g)`,
              ],
              selected: this.sellConfirm.choice,
            },
          }
        : {}),
    });
  }

  /**
   * ↑/↓ escolhe a linha, ←/→ ou Q/E (LB/RB) troca a aba, Enter/A faz o que a
   * linha diz (equipar, tirar, usar — gasta o turno), Esc/B ou I/Y fecha.
   */
  private handleInventoryInput(action: Action): void {
    if (this.sellConfirm) {
      this.handleSellConfirm(action);
      return;
    }
    const rows = this.inventoryRows();
    switch (action.type) {
      case 'move': {
        if (action.dir === 'N' || action.dir === 'S') {
          const dir = action.dir === 'N' ? -1 : 1;
          const next = this.firstSelectable(rows, this.invSelected + dir, dir);
          if (next >= 0 && next !== this.invSelected) playSfx('uiMove');
          if (next >= 0) this.invSelected = next;
        } else {
          this.switchTab(action.dir === 'W' ? -1 : 1);
          return;
        }
        break;
      }
      case 'page':
        this.switchTab(action.delta);
        return;
      case 'confirm': {
        const row = rows[this.invSelected];
        if (!row?.action) return;
        if (row.stack) {
          // Pilha na loja: pergunta antes (padrão: vender todos)
          this.sellConfirm = { ...row.stack, choice: 0 };
          break;
        }
        this.act(row.action);
        // Turno passou: level up (contra-ataque matou) ou morte fecham o inventário
        if (this.panel === 'inventory' && (this.state.prompt || this.state.status !== 'playing')) {
          this.closeInventory();
          if (this.state.prompt) this.openChoice();
          return;
        }
        const after = this.inventoryRows();
        // Fica na mesma altura da lista; se ela encolheu, sobe até uma linha válida
        this.invSelected = this.firstSelectable(after, Math.min(this.invSelected, after.length - 1), -1);
        if (this.invSelected < 0) this.invSelected = this.firstSelectable(after, 0, 1);
        break;
      }
      case 'cancel':
      case 'inventory':
        if (this.panel === 'shop') {
          if (action.type === 'inventory') return; // na loja, só Esc/B sai
          this.act({ type: 'cancel' }); // fecha o prompt no core ('shop-closed' fecha o painel)
          return;
        }
        this.closeInventory();
        return;
      default:
        return;
    }
    this.emitInventory();
  }

  /** Pergunta da venda: ←/→ (ou ↑/↓) escolhe, Enter/A vende, Esc/B volta pra lista. */
  private handleSellConfirm(action: Action): void {
    const confirm = this.sellConfirm;
    if (!confirm) return;
    if (action.type === 'move' || action.type === 'page') {
      confirm.choice = confirm.choice === 0 ? 1 : 0;
    } else if (action.type === 'confirm') {
      this.sellConfirm = null;
      this.act({ type: 'sell', itemId: confirm.itemId, count: confirm.choice === 0 ? confirm.count : 1 });
      const after = this.inventoryRows();
      this.invSelected = this.firstSelectable(after, Math.min(this.invSelected, after.length - 1), -1);
      if (this.invSelected < 0) this.invSelected = this.firstSelectable(after, 0, 1);
    } else if (action.type === 'cancel') {
      this.sellConfirm = null;
    } else {
      return;
    }
    this.emitInventory();
  }

  private switchTab(delta: number): void {
    const n = this.panelTabs().length;
    this.invTab = (this.invTab + delta + n) % n;
    this.invSelected = this.firstSelectable(this.inventoryRows(), 0, 1);
    this.emitInventory();
  }

  /** Escolha (carta/Training Room): ←/→ escolhe, Enter/A confirma. O core só recebe a escolha final. */
  private handleChoiceInput(action: Action): void {
    // Espaço / X (passar o turno) vira "rerrolar" na escolha de carta (Tome "Releitura")
    if (action.type === 'wait' && this.state.prompt?.type === 'card') {
      this.act({ type: 'reroll' });
      return;
    }
    const count = this.choiceOptions().length;
    if (action.type === 'move' && (action.dir === 'W' || action.dir === 'E')) {
      const delta = action.dir === 'W' ? -1 : 1;
      const next = Math.min(count - 1, Math.max(0, this.choice + delta));
      if (next !== this.choice) playSfx('uiMove');
      this.choice = next;
      this.emitChoice();
      return;
    }
    if (action.type !== 'confirm') return;
    const result = resolvePlayerAction(this.state, { type: 'choose', index: this.choice });
    this.playEvents(result.events);
    this.refreshView();
  }

  /** Começa (ou retoma) o jogo: some o overlay e reabre uma escolha pendente do save. */
  private startPlaying(): void {
    emitGameEvent(this.game.events, 'run-started', { seed: this.state.seed });
    if (this.state.prompt?.type === 'shop') this.openPanel('shop');
    else if (this.state.prompt) this.openChoice();
  }

  private choiceOptions(): ReturnType<typeof describeTraining> {
    const prompt = this.state.prompt;
    if (!prompt) return [];
    if (prompt.type === 'training') return describeTraining();
    if (prompt.type !== 'card') return [];
    return prompt.offer.map((id) => describeCard(id, this.state.hero));
  }

  private openChoice(): void {
    this.choice = 0;
    this.emitChoice();
  }

  private emitChoice(): void {
    const prompt = this.state.prompt;
    if (!prompt) return;
    emitGameEvent(this.game.events, 'choice-prompt', {
      title: prompt.type === 'training' ? 'TRAINING ROOM' : `NÍVEL ${this.state.hero.level}`,
      options: this.choiceOptions(),
      selected: this.choice,
      rerolls: prompt.type === 'card' ? this.state.hero.rerolls : 0,
    });
  }

  /** Aplica os eventos do core na tela, na ordem. */
  private playEvents(events: readonly CoreEvent[]): void {
    const lines: LogLine[] = [];
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
          // A câmera segue a view do player no update(), acompanhando a animação
          this.views.get(event.entityId)?.setTile(event.to);
          break;
        case 'attacked': {
          if (event.ranged) {
            // Quem arremessa aparece neste turno mesmo fora da visão (dá pra saber de onde veio)
            this.revealedThisTurn.add(event.attackerId);
            this.throwProjectile(event.attackerId, event.targetId);
          }
          const target = getEntity(this.state, event.targetId);
          const view = this.views.get(event.targetId);
          if (target) this.views.get(event.attackerId)?.faceTowards(target.pos);
          if (target && view) {
            view.setHp(event.targetHp, target.maxHp);
            view.flash();
          }
          const onPlayer = event.targetId === this.state.playerId;
          if (event.ranged) playSfx('throw');
          playSfx(onPlayer ? 'hurt' : event.critical ? 'crit' : 'hit');
          pop(
            event.targetId,
            `-${event.damage}${event.critical ? '!' : ''}`,
            onPlayer ? POP_COLORS.DAMAGE_TAKEN : POP_COLORS.DAMAGE_DEALT,
          );
          // Tremidinha só quando o player leva um golpe pesado (≥ 20% do HP max)
          if (onPlayer && target && event.damage >= target.maxHp * 0.2) this.cameras.main.shake(80, 0.004);
          break;
        }
        case 'died':
          this.views.get(event.entityId)?.die();
          playSfx(event.entityId === this.state.playerId ? 'death' : 'kill');
          // Boss caiu ou o Knight morreu: tremida mais forte (Marco 6b)
          if (event.entityId === this.state.playerId || getEntity(this.state, event.entityId)?.boss) {
            this.cameras.main.shake(260, 0.01);
          }
          break;
        case 'healed':
          this.views.get(event.entityId)?.setHp(event.hp, getEntity(this.state, event.entityId)?.maxHp ?? event.hp);
          if (event.source !== 'passive') {
            this.views.get(event.entityId)?.flashHeal();
            playSfx('heal');
          }
          pop(event.entityId, `+${event.amount}`, POP_COLORS.HEAL);
          break;
        case 'mana-restored':
          pop(this.state.playerId, `+${event.amount}`, POP_COLORS.MANA);
          break;
        case 'leveled-up': {
          playSfx('levelUp');
          const p = getPlayer(this.state);
          this.views.get(p.id)?.setHp(p.hp, p.maxHp);
          this.views.get(p.id)?.flashHeal();
          break;
        }
        case 'summoned': {
          playSfx('summon');
          const orc = getEntity(this.state, event.entityId);
          if (orc) this.views.set(orc.id, new EntityView(this, orc));
          break;
        }
        case 'enraged':
          playSfx('enrage');
          this.views.get(event.entityId)?.setEnraged();
          this.cameras.main.shake(120, 0.006);
          break;
        case 'stairs-revealed':
          this.redrawMap();
          break;
        case 'shop-opened':
          this.openPanel('shop');
          break;
        case 'shop-closed':
          this.closeInventory();
          break;
        case 'trained':
          playSfx('uiConfirm');
          this.redrawMap(); // o altar vira chão
          emitGameEvent(this.game.events, 'choice-closed', {});
          break;
        case 'card-picked':
          playSfx('uiConfirm');
          emitGameEvent(this.game.events, 'choice-closed', {});
          break;
        case 'descended':
          playSfx('stairs');
          // O core já trocou mapa e monstros: redesenha tudo e suspende a run
          this.buildFloor();
          this.cameras.main.fadeIn(250);
          saveRun(this.state);
          break;
        case 'victory':
        case 'defeat':
          if (event.type === 'victory') playSfx('victory');
          // Roguelite: run acabada não tem "Continuar". O gold converte agora,
          // antes do resumo: fechar a aba aqui não perde nada.
          clearRun();
          this.summary = closeRun(this.state, event.type === 'victory' ? 'won' : 'lost');
          emitGameEvent(this.game.events, 'run-ended', {
            result: event.type === 'victory' ? 'won' : 'lost',
            turns: this.state.turn,
          });
          break;
        case 'waited':
        case 'skill-used':
        case 'countered':
        case 'stats-changed':
        case 'rewarded':
        case 'room-cleared':
        case 'bought':
          playSfx('buy');
          break;
        case 'sold':
          playSfx('gold');
          break;
        case 'looted':
          playSfx('loot');
          break;
        case 'card-offered':
          if (event.rerolled) playSfx('uiConfirm');
          this.openChoice();
          break;
        case 'training-offered':
          this.openChoice();
          break;
        case 'equipped':
        case 'unequipped':
          break;
      }
    }
    if (lines.length > 0) emitGameEvent(this.game.events, 'log', { lines });
  }

  /**
   * Depois de cada turno: recalcula a fog, esconde monstros fora de vista e
   * manda HUD + minimapa pra UIScene.
   */
  private refreshView(): void {
    this.visible = visibleTiles(this.state);
    this.drawFog();
    const { width } = this.state.map;
    for (const entity of this.state.entities) {
      if (entity.kind === 'player') continue;
      const seen = this.visible.has(entity.pos.y * width + entity.pos.x) || this.revealedThisTurn.has(entity.id);
      this.views.get(entity.id)?.container.setVisible(seen);
    }
    this.revealedThisTurn.clear();
    this.emitBossStatus();
    emitGameEvent(this.game.events, 'hud', buildHud(this.state));
    emitGameEvent(this.game.events, 'minimap', buildMinimap(this.state, this.visible));
  }

  /** Barra do boss no topo do mapa enquanto ele está vivo e à vista (ou já foi visto lutando). */
  private emitBossStatus(): void {
    const boss = this.state.entities.find((e) => e.boss);
    const { width } = this.state.map;
    if (boss && boss.hp > 0 && (this.bossSeen || this.visible.has(boss.pos.y * width + boss.pos.x))) {
      this.bossSeen = true;
      emitGameEvent(this.game.events, 'boss-status', {
        name: boss.name,
        hp: boss.hp,
        maxHp: boss.maxHp,
        enraged: boss.enraged === true,
      });
    } else {
      this.bossSeen = false;
      emitGameEvent(this.game.events, 'boss-status', null);
    }
  }

  /** Projétil (pedra, lança, facas): risco rápido do atacante até o alvo. */
  private throwProjectile(fromId: string, toId: string): void {
    const from = getEntity(this.state, fromId);
    const to = getEntity(this.state, toId);
    if (!from || !to) return;
    const center = (p: { x: number; y: number }): { x: number; y: number } => ({
      x: p.x * TILE_SIZE + TILE_SIZE / 2,
      y: p.y * TILE_SIZE + TILE_SIZE / 2,
    });
    const a = center(from.pos);
    const b = center(to.pos);
    const dart = this.add.rectangle(a.x, a.y, 8, 3, COLORS.PROJECTILE).setDepth(15);
    dart.setRotation(Math.atan2(b.y - a.y, b.x - a.x));
    this.tweens.add({ targets: dart, x: b.x, y: b.y, duration: 140, ease: 'Linear', onComplete: () => dart.destroy() });
  }

  /**
   * Fog of war por cima do mapa: tile nunca visto fica da cor do fundo;
   * explorado fora de vista fica escurecido (memória do andar).
   */
  private drawFog(): void {
    const { map } = this.state;
    const explored = new Set(this.state.explored);
    const g = this.fogGraphics ?? this.add.graphics().setDepth(-0.5);
    this.fogGraphics = g;
    g.clear();
    for (let i = 0; i < map.width * map.height; i++) {
      if (this.visible.has(i)) continue;
      const seen = explored.has(i);
      g.fillStyle(FOG.UNSEEN, seen ? FOG.REMEMBERED_ALPHA : 1);
      g.fillRect((i % map.width) * TILE_SIZE, Math.floor(i / map.width) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  private showGameOver(summary: RunSummary): void {
    this.scene.stop(SCENE_KEYS.UI);
    this.scene.start(SCENE_KEYS.GAME_OVER, summary);
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
