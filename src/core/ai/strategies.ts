import type { AiId, Entity } from '../entities/Entity';
import { isWalkable } from '../dungeon/DungeonMap';
import { isAdjacent4, type Direction } from '../grid';
import { bfsFirstStep } from '../pathfinding';
import { entityAt, getPlayer, type RunState } from '../run';

/** O que um inimigo quer fazer neste turno. O TurnManager executa. */
export type EnemyIntent =
  | { readonly type: 'attack'; readonly targetId: string }
  | { readonly type: 'move'; readonly dir: Direction }
  | { readonly type: 'idle' };

/**
 * Estratégia de IA: função pura que olha o estado e decide.
 * Injetada por id (Entity.ai) pra o estado continuar serializável;
 * o TurnManager aceita outro registro, o que facilita teste e variantes.
 */
export type AiStrategy = (self: Entity, state: RunState) => EnemyIntent;

/** Persegue o player pelo caminho mais curto (BFS) e ataca quando encosta. */
export const chase: AiStrategy = (self, state) => {
  const player = getPlayer(state);
  if (isAdjacent4(self.pos, player.pos)) return { type: 'attack', targetId: player.id };

  const dir = bfsFirstStep(
    self.pos,
    player.pos,
    // Contorna paredes e outros monstros
    (p) => isWalkable(state.map, p) && entityAt(state, p) === undefined,
  );
  return dir ? { type: 'move', dir } : { type: 'idle' };
};

export type AiRegistry = Readonly<Record<AiId, AiStrategy>>;

export const AI_STRATEGIES: AiRegistry = {
  chase,
};
