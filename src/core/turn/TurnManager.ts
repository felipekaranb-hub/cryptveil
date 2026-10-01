import type { Action } from '../actions';
import { AI_STRATEGIES, type AiRegistry, type EnemyIntent } from '../ai/strategies';
import { rollDamage } from '../combat/damage';
import { isWalkable } from '../dungeon/DungeonMap';
import { isAlive, type Entity } from '../entities/Entity';
import type { CoreEvent } from '../events';
import { step, type Direction } from '../grid';
import { Rng } from '../rng';
import { entityAt, getPlayer, livingEnemies, type RunState } from '../run';

/**
 * Resultado de uma ação do jogador (discriminated union).
 * tookTurn: false → nada mudou e os inimigos não agiram.
 */
export type TurnResult =
  | {
      readonly tookTurn: false;
      readonly reason: 'wall' | 'not-playing' | 'not-a-turn-action';
      readonly events: readonly CoreEvent[];
    }
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
  if (state.status !== 'playing') return { tookTurn: false, reason: 'not-playing', events: [] };

  const rng = Rng.fromState(state.rngState);
  const events: CoreEvent[] = [];
  const player = getPlayer(state);

  // --- vez do jogador
  switch (action.type) {
    case 'move': {
      const acted = moveOrAttack(state, player, action.dir, rng, events);
      if (!acted) return { tookTurn: false, reason: 'wall', events: [] };
      break;
    }
    case 'wait':
      events.push({ type: 'waited', entityId: player.id });
      break;
    default:
      // Skills, inventário etc. chegam no Marco 2/3
      return { tookTurn: false, reason: 'not-a-turn-action', events: [] };
  }

  if (livingEnemies(state).length === 0) {
    finish(state, 'won', events);
  } else {
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
  }

  state.turn += 1;
  state.rngState = rng.getState();
  return { tookTurn: true, events };
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
    attack(actor, occupant, rng, events);
    return true;
  }
  if (!isWalkable(state.map, target)) return false;
  const from = actor.pos;
  actor.pos = target;
  events.push({ type: 'moved', entityId: actor.id, from, to: target });
  return true;
}

function attack(attacker: Entity, target: Entity, rng: Rng, events: CoreEvent[]): void {
  const damage = rollDamage(attacker.atk, target.def, rng);
  target.hp = Math.max(0, target.hp - damage);
  events.push({
    type: 'attacked',
    attackerId: attacker.id,
    targetId: target.id,
    damage,
    targetHp: target.hp,
  });
  if (target.hp === 0) events.push({ type: 'died', entityId: target.id });
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
      if (target && isAlive(target)) attack(enemy, target, rng, events);
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
