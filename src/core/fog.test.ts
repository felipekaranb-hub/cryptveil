import { describe, expect, it } from 'vitest';
import { CORRIDOR_VISION } from './balance';
import { roomIndexAt } from './dungeon/Room';
import { isWalkable, TileType } from './dungeon/DungeonMap';
import { isExplored, revealAround, visibleTiles } from './fog';
import { manhattan } from './grid';
import { createRun, getPlayer, type RunState } from './run';
import { resolvePlayerAction } from './turn/TurnManager';
import { bfsFirstStep } from './pathfinding';

const key = (s: RunState, x: number, y: number): number => y * s.map.width + x;

/** Primeiro tile de corredor (chão fora de qualquer sala) do andar. */
function corridorTile(state: RunState): { x: number; y: number } {
  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      const p = { x, y };
      if (isWalkable(state.map, p) && roomIndexAt(state.rooms, p) < 0) return p;
    }
  }
  throw new Error('andar sem corredor');
}

describe('fog of war', () => {
  it('run nova já começa com a sala inicial inteira (e as paredes dela) explorada', () => {
    const state = createRun(48213);
    const room = state.rooms[roomIndexAt(state.rooms, getPlayer(state).pos)]!;
    for (let y = room.y - 1; y <= room.y + room.h; y++) {
      for (let x = room.x - 1; x <= room.x + room.w; x++) expect(isExplored(state, { x, y })).toBe(true);
    }
    // Nada de outra sala aparece
    const other = state.rooms.find((r) => r !== room)!;
    expect(isExplored(state, { x: other.x + 1, y: other.y + 1 })).toBe(false);
  });

  it('no corredor vê só pelo chão até CORRIDOR_VISION (e as paredes em volta)', () => {
    const state = createRun(7);
    const p = corridorTile(state);
    getPlayer(state).pos = p;
    const visible = visibleTiles(state);
    for (const k of visible) {
      const t = { x: k % state.map.width, y: Math.floor(k / state.map.width) };
      // Tudo visível está a no máximo visão + 1 (a parede encostada) em cada eixo
      expect(Math.abs(t.x - p.x)).toBeLessThanOrEqual(CORRIDOR_VISION + 1);
      expect(Math.abs(t.y - p.y)).toBeLessThanOrEqual(CORRIDOR_VISION + 1);
      if (isWalkable(state.map, t) && roomIndexAt(state.rooms, t) < 0) {
        expect(manhattan(t, p)).toBeLessThanOrEqual(CORRIDOR_VISION);
      }
    }
    expect(visible.has(key(state, p.x, p.y))).toBe(true);
  });

  it('andar pelo mapa só aumenta o explorado; descer zera e revela só a sala nova', () => {
    const state = createRun(99);
    state.entities = [getPlayer(state)]; // sem monstros: só andar até a escada
    const stairs = state.map.tiles.indexOf(TileType.STAIRS);
    const goal = { x: stairs % state.map.width, y: Math.floor(stairs / state.map.width) };
    let before = state.explored.length;
    for (let turn = 0; turn < 400 && state.floor === 1; turn++) {
      const dir = bfsFirstStep(getPlayer(state).pos, goal, (q) => isWalkable(state.map, q))!;
      resolvePlayerAction(state, { type: 'move', dir });
      if (state.floor === 1) {
        expect(state.explored.length).toBeGreaterThanOrEqual(before);
        before = state.explored.length;
      }
    }
    expect(state.floor).toBe(2);
    const room = state.rooms[roomIndexAt(state.rooms, getPlayer(state).pos)]!;
    const inRing = (k: number): boolean => {
      const x = k % state.map.width;
      const y = Math.floor(k / state.map.width);
      return x >= room.x - 1 && x <= room.x + room.w && y >= room.y - 1 && y <= room.y + room.h;
    };
    expect(state.explored.length).toBe((room.w + 2) * (room.h + 2));
    expect(state.explored.every(inRing)).toBe(true);
  });

  it('revealAround é idempotente e mantém a lista ordenada sem repetição', () => {
    const state = createRun(3);
    const snapshot = [...state.explored];
    revealAround(state);
    expect(state.explored).toEqual(snapshot);
    expect(new Set(snapshot).size).toBe(snapshot.length);
    expect([...snapshot].sort((a, b) => a - b)).toEqual(snapshot);
  });
});
