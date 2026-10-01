import { ENTITY_TEMPLATES } from './data/entities';
import { generateFloor } from './dungeon/DungeonGenerator';
import { createTestRoom, type DungeonMap } from './dungeon/DungeonMap';
import { spawnEnemies } from './dungeon/populate';
import type { Room } from './dungeon/Room';
import { createEntity, isAlive, type Entity } from './entities/Entity';
import { samePoint, type Point } from './grid';
import { Rng, type RngState } from './rng';

export type RunStatus = 'playing' | 'won' | 'lost';

/** Versão do formato do RunState (e do save da run). Subiu pra 2 com os andares. */
export const RUN_STATE_VERSION = 2;

/**
 * Estado completo da run. JSON puro: JSON.stringify/parse e continua
 * exatamente de onde parou (inclusive a sequência de sorteios).
 */
export interface RunState {
  readonly version: typeof RUN_STATE_VERSION;
  readonly seed: number;
  rngState: RngState;
  turn: number;
  status: RunStatus;
  /** Andar atual, começando em 1. */
  floor: number;
  map: DungeonMap;
  rooms: Room[];
  entities: Entity[];
  readonly playerId: string;
}

/** Run nova: andar 1 gerado pelo BSP a partir do seed. */
export function createRun(seed: number): RunState {
  const rng = Rng.fromSeed(seed);
  const floor = generateFloor(rng);
  const knight = createEntity('player', ENTITY_TEMPLATES.knight, floor.start);
  const enemies = spawnEnemies(1, floor, rng);
  return {
    version: RUN_STATE_VERSION,
    seed,
    rngState: rng.getState(),
    turn: 0,
    status: 'playing',
    floor: 1,
    map: floor.map,
    rooms: floor.rooms,
    entities: [knight, ...enemies],
    playerId: knight.id,
  };
}

/**
 * Troca pro próximo andar: mapa e monstros novos, o player mantém o que tem.
 * Usa o Rng da run (quem chama salva o estado dele depois).
 */
export function enterNextFloor(state: RunState, rng: Rng): void {
  const player = getPlayer(state);
  const next = state.floor + 1;
  const floor = generateFloor(rng);
  player.pos = { ...floor.start };
  state.floor = next;
  state.map = floor.map;
  state.rooms = floor.rooms;
  state.entities = [player, ...spawnEnemies(next, floor, rng)];
}

export const TEST_ROOM = { width: 15, height: 11 } as const;

/** Testes: sala fixa 15×11 com o Knight à esquerda e um Goblin à direita. */
export function createTestRun(seed: number): RunState {
  const knight = createEntity('player', ENTITY_TEMPLATES.knight, { x: 3, y: 5 });
  const goblin = createEntity('goblin-1', ENTITY_TEMPLATES.goblinDummy, { x: 11, y: 5 });
  return {
    version: RUN_STATE_VERSION,
    seed,
    rngState: Rng.fromSeed(seed).getState(),
    turn: 0,
    status: 'playing',
    floor: 1,
    map: createTestRoom(TEST_ROOM.width, TEST_ROOM.height),
    rooms: [{ x: 1, y: 1, w: TEST_ROOM.width - 2, h: TEST_ROOM.height - 2 }],
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
