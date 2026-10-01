import { describe, expect, it } from 'vitest';
import type { Action } from './actions';
import { FINAL_FLOOR } from './balance';
import { getTile, isWalkable, TileType } from './dungeon/DungeonMap';
import { roomIndexAt } from './dungeon/Room';
import { pointKey, step, type Direction, type Point } from './grid';
import { bfsFirstStep } from './pathfinding';
import { refreshPlayerStats } from './hero';
import { createRun, getPlayer, livingEnemies, type RunState } from './run';
import { resolvePlayerAction } from './turn/TurnManager';

function findStairs(state: RunState): Point {
  const i = state.map.tiles.indexOf(TileType.STAIRS);
  return { x: i % state.map.width, y: Math.floor(i / state.map.width) };
}

/** Anda até a escada (atacando quem estiver no caminho) até mudar de andar ou acabar. */
function walkToStairs(state: RunState, maxTurns = 400): void {
  const startFloor = state.floor;
  for (let i = 0; i < maxTurns && state.floor === startFloor && state.status === 'playing'; i++) {
    if (state.prompt) {
      resolvePlayerAction(state, { type: 'choose', index: 0 });
      continue;
    }
    const dir: Direction | null = bfsFirstStep(getPlayer(state).pos, findStairs(state), (p) =>
      isWalkable(state.map, p),
    );
    if (!dir) throw new Error('sem caminho até a escada');
    resolvePlayerAction(state, { type: 'move', dir } satisfies Action);
  }
}

describe('createRun', () => {
  it('começa no andar 1 com o Knight na sala inicial e monstros fora dela', () => {
    const state = createRun(48213);
    const player = getPlayer(state);
    expect(state.floor).toBe(1);
    expect(state.status).toBe('playing');
    expect(isWalkable(state.map, player.pos)).toBe(true);

    const startRoom = roomIndexAt(state.rooms, player.pos);
    expect(startRoom).toBeGreaterThanOrEqual(0);
    const enemies = livingEnemies(state);
    expect(enemies.length).toBeGreaterThan(0);
    for (const e of enemies) {
      expect(isWalkable(state.map, e.pos)).toBe(true);
      expect(getTile(state.map, e.pos)).toBe(TileType.FLOOR); // nunca em cima da escada
      expect(roomIndexAt(state.rooms, e.pos)).not.toBe(startRoom);
    }
    // Ninguém empilhado no mesmo tile
    const keys = state.entities.map((e) => pointKey(e.pos));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('mesmo seed → mesma run', () => {
    expect(createRun(9)).toEqual(createRun(9));
  });

  it('o estado inicial é JSON puro', () => {
    const state = createRun(5);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('descer de andar', () => {
  it('pisar na escada leva ao andar 2 com mapa e monstros novos, mantendo o HP', () => {
    const state = createRun(48213);
    const player = getPlayer(state);
    player.hp = 9999; // sobrevive a qualquer coisa no caminho
    player.maxHp = 9999;
    const oldMap = state.map;

    walkToStairs(state);

    expect(state.floor).toBe(2);
    expect(state.map).not.toEqual(oldMap);
    expect(getPlayer(state)).toBe(player);
    expect(player.hp).toBeGreaterThan(0);
    expect(roomIndexAt(state.rooms, player.pos)).toBeGreaterThanOrEqual(0);
    // Só o player e os monstros do andar novo
    expect(state.entities.filter((e) => e.kind === 'enemy').every((e) => e.id.startsWith('e2-'))).toBe(true);
  });

  it('o evento descended sai sozinho: monstros do andar velho não agem depois', () => {
    const state = createRun(48213);
    getPlayer(state).hp = 9999;
    const stairs = findStairs(state);
    // Teleporta pra um vizinho andável da escada e pisa nela
    const dirs: Direction[] = ['N', 'S', 'E', 'W'];
    const from = dirs.map((d) => ({ d, p: step(stairs, d) })).find(({ p }) => isWalkable(state.map, p));
    if (!from) throw new Error('escada sem vizinho');
    getPlayer(state).pos = from.p;
    const back: Record<Direction, Direction> = { N: 'S', S: 'N', E: 'W', W: 'E' };
    const r = resolvePlayerAction(state, { type: 'move', dir: back[from.d] });

    expect(r.events.at(-1)).toEqual({ type: 'descended', floor: 2, hasTraining: false });
    expect(r.events.filter((e) => e.type === 'attacked')).toHaveLength(0);
  });

  it(`a escada do andar ${FINAL_FLOOR} termina a run em vitória`, () => {
    const state = createRun(777);
    const player = getPlayer(state);
    player.hp = 99999;
    player.maxHp = 99999;
    state.hero.trainedAtk = 999; // mata tudo de um golpe pra não demorar
    refreshPlayerStats(state.hero, player);
    for (let f = 1; f <= FINAL_FLOOR; f++) walkToStairs(state);
    expect(state.status).toBe('won');
    expect(state.floor).toBe(FINAL_FLOOR);
  });

  it('mesmo seed + mesmas ações → mesmos andares', () => {
    const a = createRun(31337);
    const b = createRun(31337);
    for (const s of [a, b]) {
      getPlayer(s).hp = 9999;
      walkToStairs(s);
      walkToStairs(s);
    }
    expect(a).toEqual(b);
  });
});
