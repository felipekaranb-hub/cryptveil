import type { AiId, Entity } from '../entities/Entity';
import { isWalkable } from '../dungeon/DungeonMap';
import { AGGRO_RANGE } from '../balance';
import { isAdjacent4, manhattan, samePoint, step, DIRECTIONS, type Direction } from '../grid';
import { bfsFirstStep } from '../pathfinding';
import { entityAt, getPlayer, type RunState } from '../run';

/** O que um inimigo quer fazer neste turno. O TurnManager executa. */
export type EnemyIntent =
  | { readonly type: 'attack'; readonly targetId: string }
  /** Arremesso de longe (Marco 4). O TurnManager aplica a recarga. */
  | { readonly type: 'ranged'; readonly targetId: string }
  | { readonly type: 'move'; readonly dir: Direction }
  | { readonly type: 'idle' };

/**
 * Estratégia de IA: função pura que olha o estado e decide.
 * Injetada por id (Entity.ai) pra o estado continuar serializável;
 * o TurnManager aceita outro registro, o que facilita teste e variantes.
 */
export type AiStrategy = (self: Entity, state: RunState) => EnemyIntent;

/**
 * Persegue o player pelo caminho mais curto (BFS) e ataca quando encosta.
 * Só acorda com o player a até AGGRO_RANGE: sem isso o andar inteiro
 * convergiria pra cima dele no primeiro turno.
 */
export const chase: AiStrategy = (self, state) => {
  const player = getPlayer(state);
  if (isAdjacent4(self.pos, player.pos)) return { type: 'attack', targetId: player.id };
  if (manhattan(self.pos, player.pos) > AGGRO_RANGE) return { type: 'idle' };

  const dir = bfsFirstStep(
    self.pos,
    player.pos,
    // Contorna paredes e outros monstros
    (p) => isWalkable(state.map, p) && entityAt(state, p) === undefined,
  );
  return dir ? { type: 'move', dir } : { type: 'idle' };
};

/**
 * Persegue como o chase, mas arremessa de longe quando o player está em
 * linha reta ao alcance, sem nada no meio, e a recarga zerou (Goblin pedra,
 * Orc lança, Orc Warlord facas). Nos outros turnos continua avançando:
 * o arremesso ganha turno, não vira kiting (decisão do Felipe, Marco 4).
 */
export const skirmisher: AiStrategy = (self, state) => {
  const player = getPlayer(state);
  const ranged = self.ranged;
  if (
    ranged &&
    (self.rangedCooldown ?? 0) <= 0 &&
    !isAdjacent4(self.pos, player.pos) &&
    manhattan(self.pos, player.pos) <= Math.min(ranged.range, AGGRO_RANGE) &&
    hasClearLine(state, self.pos, player.pos)
  ) {
    return { type: 'ranged', targetId: player.id };
  }
  return chase(self, state);
};

/** Mesma linha ou coluna, e tudo entre os dois é chão livre (sem parede nem ninguém). */
export function hasClearLine(state: RunState, from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  if (from.x !== to.x && from.y !== to.y) return false;
  const dir = DIRECTIONS.find((d) => {
    const n = step(from, d);
    return Math.sign(n.x - from.x) === Math.sign(to.x - from.x) && Math.sign(n.y - from.y) === Math.sign(to.y - from.y);
  });
  if (!dir) return false;
  let p = step(from, dir);
  while (!samePoint(p, to)) {
    if (!isWalkable(state.map, p) || entityAt(state, p)) return false;
    p = step(p, dir);
  }
  return true;
}

export type AiRegistry = Readonly<Record<AiId, AiStrategy>>;

export const AI_STRATEGIES: AiRegistry = {
  chase,
  skirmisher,
};
