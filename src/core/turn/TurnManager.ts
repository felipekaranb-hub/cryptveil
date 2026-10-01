import type { Action } from '../actions';
import { AI_STRATEGIES, type AiRegistry, type EnemyIntent } from '../ai/strategies';
import { FINAL_FLOOR, MANA_REGEN_EVERY_TURNS } from '../balance';
import { getTile, isWalkable, TileType } from '../dungeon/DungeonMap';
import { isAlive, type Entity } from '../entities/Entity';
import type { CoreEvent } from '../events';
import { step, type Direction } from '../grid';
import { Rng } from '../rng';
import { enterNextFloor, entityAt, getPlayer, livingEnemies, type RunState } from '../run';
import { attack } from './combat';
import { applyTrainingChoice, updateRoomProgress } from './rooms';
import { useHotbarSlot, type HotbarFailure } from './skills';

/** Por que a ação não gastou turno. */
export type TurnFailure = 'wall' | 'not-playing' | 'awaiting-choice' | HotbarFailure;

/**
 * Resultado de uma ação do jogador (discriminated union).
 * - tookTurn: false + reason → nada mudou e os inimigos não agiram.
 * - 'free-action' → mudou o estado (escolha da Training Room) sem gastar turno.
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

  // Prompt aberto (Training Room): só a escolha passa, e ela não gasta turno
  if (state.prompt === 'training') {
    if (action.type !== 'choose') return fail('awaiting-choice');
    if (!applyTrainingChoice(state, action.index, events)) return fail('not-a-turn-action');
    return { tookTurn: false, reason: 'free-action', events };
  }

  const rng = Rng.fromState(state.rngState);
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
    default:
      // Inventário etc. chegam no Marco 3
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
      state.prompt = 'training';
      events.push({ type: 'training-offered' });
    }
    // --- vez dos inimigos, na ordem da lista
    for (const enemy of livingEnemies(state)) {
      const strategy = enemy.ai ? ai[enemy.ai] : undefined;
      if (!strategy) continue;
      applyEnemyIntent(state, enemy, strategy(enemy, state), rng, events);
      if (!isAlive(player)) {
        finish(state, 'lost', events);
        break;
      }
    }
    if (state.status === 'playing') updateRoomProgress(state, events);
  }

  state.turn += 1;
  if (state.turn % MANA_REGEN_EVERY_TURNS === 0) {
    state.hero.mana = Math.min(state.hero.maxMana, state.hero.mana + 1);
  }
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
    case 'move':
      moveOrAttack(state, enemy, intent.dir, rng, events);
      return;
    case 'idle':
      return;
  }
}

function finish(state: RunState, status: 'won' | 'lost', events: CoreEvent[]): void {
  state.status = status;
  events.push({ type: status === 'won' ? 'victory' : 'defeat' });
}
