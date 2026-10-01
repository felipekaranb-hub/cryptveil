import { ENTITY_TEMPLATES } from './data/entities';
import { createTestRoom, type DungeonMap } from './dungeon/DungeonMap';
import { createEntity, isAlive, type Entity } from './entities/Entity';
import { samePoint, type Point } from './grid';
import { Rng, type RngState } from './rng';

export type RunStatus = 'playing' | 'won' | 'lost';

/**
 * Estado completo da run. JSON puro: JSON.stringify/parse e continua
 * exatamente de onde parou (inclusive a sequência de sorteios).
 */
export interface RunState {
  readonly version: 1;
  readonly seed: number;
  rngState: RngState;
  turn: number;
  status: RunStatus;
  map: DungeonMap;
  entities: Entity[];
  readonly playerId: string;
}

export const TEST_ROOM = { width: 15, height: 11 } as const;

/** Marco 1: sala fixa com o Knight à esquerda e um Goblin à direita. */
export function createTestRun(seed: number): RunState {
  const knight = createEntity('player', ENTITY_TEMPLATES.knight, { x: 3, y: 5 });
  const goblin = createEntity('goblin-1', ENTITY_TEMPLATES.goblinDummy, { x: 11, y: 5 });
  return {
    version: 1,
    seed,
    rngState: Rng.fromSeed(seed).getState(),
    turn: 0,
    status: 'playing',
    map: createTestRoom(TEST_ROOM.width, TEST_ROOM.height),
    entities: [knight, goblin],
    playerId: knight.id,
  };
}

export function getPlayer(state: RunState): Entity {
  const p = state.entities.find((e) => e.id === state.playerId);
  if (!p) throw new Error('RunState sem player');
  return p;
}

export function getEntity(state: RunState, id: string): Entity | undefined {
  return state.entities.find((e) => e.id === id);
}

/** Entidade VIVA no tile (mortas não ocupam espaço). */
export function entityAt(state: RunState, p: Point): Entity | undefined {
  return state.entities.find((e) => isAlive(e) && samePoint(e.pos, p));
}

export function livingEnemies(state: RunState): Entity[] {
  return state.entities.filter((e) => e.kind === 'enemy' && isAlive(e));
}
