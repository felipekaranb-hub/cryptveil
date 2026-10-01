import type { Action } from '../actions';
import { AI_STRATEGIES, type AiRegistry, type EnemyIntent } from '../ai/strategies';
import { applyCard, openCardPromptIfPending } from '../cards';
import { AGGRO_RANGE, FINAL_FLOOR } from '../balance';
import { ENTITY_TEMPLATES } from '../data/entities';
import { buyOffer, sellItem, type ShopFailure } from '../shop';
import { getTile, isWalkable, TileType } from '../dungeon/DungeonMap';
import { createEntity, isAlive, type Entity } from '../entities/Entity';
import { revealAround } from '../fog';
import { equipFromBag, unequipSlot, type EquipFailure } from '../items/Inventory';
import type { CoreEvent } from '../events';
import { DIRECTIONS, manhattan, step, type Direction } from '../grid';
import { Rng } from '../rng';
import { enterNextFloor, entityAt, getPlayer, livingEnemies, type RunState } from '../run';
import { attack } from './combat';
import { applyTrainingChoice, updateRoomProgress } from './rooms';
import { useHotbarSlot, usePotion, type HotbarFailure } from './skills';

/** Por que a ação não gastou turno. */
export type TurnFailure =
  | 'wall'
  | 'not-playing'
  | 'awaiting-choice'
  | HotbarFailure
  | EquipFailure
  | ShopFailure
  | 'empty-slot';

/**
 * Resultado de uma ação do jogador (discriminated union).
 * - tookTurn: false + reason → nada mudou e os inimigos não agiram.
 * - 'free-action' → mudou o estado (escolha de carta ou da Training Room) sem gastar turno.
 */
export type TurnResult =
  | { readonly tookTurn: false; readonly reason: TurnFailure; readonly events: readonly CoreEvent[] }
  | { readonly tookTurn: false; readonly reason: 'free-action'; readonly events: readonly CoreEvent[] }
  | { readonly tookTurn: true; readonly events: readonly CoreEvent[] };

/**
 * Coração do jogo. Aplica a ação do jogador e, se ela gastou o turno,
 * a vez de cada inimigo. Ordem fixa: jogador primeiro, depois inimigos.
 *
 * MUTA o `state` recebido (inclusive o estado do RNG). Síncrono: quem
 * espera animação é a view, lendo a lista de eventos.
 */
export function resolvePlayerAction(
  state: RunState,
  action: Action,
  ai: AiRegistry = AI_STRATEGIES,
): TurnResult {
  if (state.status !== 'playing') return fail('not-playing');

  const events: CoreEvent[] = [];

  const rng = Rng.fromState(state.rngState);

  // Loja aberta: comprar, vender e sair não gastam turno
  if (state.prompt?.type === 'shop') {
    if (action.type === 'buy' || action.type === 'sell') {
      const done = action.type === 'buy'
          ? buyOffer(state, action.index, events)
          : sellItem(state, action.itemId, events, action.count ?? 1);
      if (done !== true) return fail(done);
    } else if (action.type === 'cancel') {
      state.prompt = null;
      events.push({ type: 'shop-closed' });
    } else {
      return fail('awaiting-choice');
    }
    state.rngState = rng.getState();
    return { tookTurn: false, reason: 'free-action', events };
  }

  // Prompt aberto (carta ou Training Room): só a escolha passa, e ela não gasta turno
  if (state.prompt) {
    if (action.type !== 'choose') return fail('awaiting-choice');
    if (state.prompt.type === 'training') {
      if (!applyTrainingChoice(state, action.index, events)) return fail('not-a-turn-action');
    } else {
      const cardId = state.prompt.offer[action.index];
      if (!cardId) return fail('not-a-turn-action');
      state.prompt = null;
      applyCard(state, cardId, events);
    }
    // Subiu vários níveis de uma vez: a próxima escolha já abre
    openCardPromptIfPending(state, rng, events);
    state.rngState = rng.getState();
    return { tookTurn: false, reason: 'free-action', events };
  }

  const player = getPlayer(state);

  // --- vez do jogador
  switch (action.type) {
    case 'move': {
      const acted = moveOrAttack(state, player, action.dir, rng, events);
      if (!acted) return fail('wall');
      state.hero.facing = action.dir;
      break;
    }
    case 'wait':
      events.push({ type: 'waited', entityId: player.id });
      break;
    case 'skill': {
      const used = useHotbarSlot(state, action.slot, rng, events);
      if (used !== true) return fail(used);
      break;
    }
    // Inventário (Marco 3): trocar equipamento ou tomar poção gasta o turno
    case 'equip': {
      const done = equipFromBag(state.hero, player, action.itemId, events);
      if (done !== true) return fail(done);
      break;
    }
    case 'unequip': {
      const done = unequipSlot(state.hero, player, action.slot, events);
      if (done !== true) return fail(done);
      break;
    }
    case 'use-item': {
      const used = usePotion(state, action.itemId, events);
      if (used !== true) return fail(used);
      break;
    }
    default:
      // Abrir inventário, trocar aba etc. são da view
      return fail('not-a-turn-action');
  }

  const tile = getTile(state.map, player.pos);
  if (tile === TileType.STAIRS) {
    // Escada: desce na hora e os monstros do andar velho não agem.
    // A escada do andar final termina a run (Marco 4: Orc Warlord antes dela).
    if (state.floor >= FINAL_FLOOR) {
      finish(state, 'won', events);
    } else {
      const hasTraining = enterNextFloor(state, rng);
      events.push({ type: 'descended', floor: state.floor, hasTraining });
    }
  } else {
    if (tile === TileType.TRAINING) {
      state.prompt = { type: 'training' };
      events.push({ type: 'training-offered' });
    } else if (tile === TileType.MERCHANT && state.merchant && action.type === 'move') {
      state.prompt = { type: 'shop' };
      events.push({ type: 'shop-opened' });
    }
    // --- vez dos inimigos, na ordem da lista
    for (const enemy of livingEnemies(state)) {
      const strategy = enemy.ai ? ai[enemy.ai] : undefined;
      if (!strategy) continue;
      if (enemy.rangedCooldown) enemy.rangedCooldown -= 1;
      if (enemy.summon) trySummon(state, enemy, events);
      applyEnemyIntent(state, enemy, strategy(enemy, state), rng, events);
      if (!isAlive(player)) {
        finish(state, 'lost', events);
        break;
      }
    }
    if (state.status === 'playing') updateRoomProgress(state, events);
  }

  // Level up neste turno: abre a escolha de carta (depois da Training Room, se as duas)
  openCardPromptIfPending(state, rng, events);
  revealAround(state);
  state.turn += 1;
  state.rngState = rng.getState();
  return { tookTurn: true, events };
}

function fail(reason: TurnFailure): TurnResult {
  return { tookTurn: false, reason, events: [] };
}

/**
 * Bump: se tem alguém vivo no tile, ataca (só esse tile, handoff §2.10).
 * Parede: não faz nada e devolve false (não gasta turno).
 */
function moveOrAttack(
  state: RunState,
  actor: Entity,
  dir: Direction,
  rng: Rng,
  events: CoreEvent[],
): boolean {
  const target = step(actor.pos, dir);
  const occupant = entityAt(state, target);
  if (occupant) {
    if (occupant.kind === actor.kind) return false; // não ataca aliado
    attack(state, actor, occupant, 1, rng, events);
    return true;
  }
  if (!isWalkable(state.map, target)) return false;
  const from = actor.pos;
  actor.pos = target;
  events.push({ type: 'moved', entityId: actor.id, from, to: target });
  return true;
}

function applyEnemyIntent(
  state: RunState,
  enemy: Entity,
  intent: EnemyIntent,
  rng: Rng,
  events: CoreEvent[],
): void {
  switch (intent.type) {
    case 'attack': {
      const target = state.entities.find((e) => e.id === intent.targetId);
      if (target && isAlive(target)) attack(state, enemy, target, 1, rng, events);
      return;
    }
    case 'ranged': {
      const target = state.entities.find((e) => e.id === intent.targetId);
      if (!target || !isAlive(target) || !enemy.ranged) return;
      enemy.rangedCooldown = enemy.ranged.cooldown;
      attack(state, enemy, target, enemy.ranged.multiplier, rng, events, { projectile: enemy.ranged.projectile });
      return;
    }
    case 'move':
      moveOrAttack(state, enemy, intent.dir, rng, events);
      return;
    case 'idle':
      return;
  }
}

/**
 * Invocação do boss (§2.2): com o player por perto, a cada `every` turnos
 * nasce 1 Orc num tile livre colado nele, até `max` invocados vivos.
 * É de graça: o boss ainda age normalmente no mesmo turno.
 */
function trySummon(state: RunState, boss: Entity, events: CoreEvent[]): void {
  const summon = boss.summon;
  const player = getPlayer(state);
  if (!summon || manhattan(boss.pos, player.pos) > AGGRO_RANGE) return;
  boss.summonTimer = (boss.summonTimer ?? summon.every) - 1;
  if (boss.summonTimer > 0) return;
  const alive = state.entities.filter((e) => e.summoned && isAlive(e)).length;
  const spot = DIRECTIONS.map((d) => step(boss.pos, d)).find((p) => isWalkable(state.map, p) && !entityAt(state, p));
  if (alive >= summon.max || !spot) return; // tenta de novo no próximo turno
  boss.summonTimer = summon.every;
  const orc = createEntity(`${boss.id}-s${state.entities.length}`, ENTITY_TEMPLATES.orc, spot);
  orc.summoned = true;
  if (boss.homeRoom !== undefined) orc.homeRoom = boss.homeRoom;
  state.entities.push(orc);
  events.push({ type: 'summoned', entityId: orc.id, by: boss.id });
}

function finish(state: RunState, status: 'won' | 'lost', events: CoreEvent[]): void {
  state.status = status;
  events.push({ type: status === 'won' ? 'victory' : 'defeat' });
}
