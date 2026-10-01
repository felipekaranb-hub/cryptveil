import { describe, expect, it } from 'vitest';
import { DUNGEON } from '../balance';
import { DIRECTIONS, pointKey, samePoint, step, type Point } from '../grid';
import { Rng } from '../rng';
import { generateFloor } from './DungeonGenerator';
import { getTile, isWalkable, TileType, type DungeonMap } from './DungeonMap';
import { roomContains } from './Room';

/** Todos os tiles andáveis alcançáveis a partir de `from`. */
function reachable(map: DungeonMap, from: Point): Set<string> {
  const seen = new Set([pointKey(from)]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (const d of DIRECTIONS) {
      const n = step(queue[i] as Point, d);
      if (isWalkable(map, n) && !seen.has(pointKey(n))) {
        seen.add(pointKey(n));
        queue.push(n);
      }
    }
  }
  return seen;
}

function walkableCount(map: DungeonMap): number {
  return map.tiles.filter((t) => t !== TileType.WALL).length;
}

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 1);

describe('generateFloor (BSP)', () => {
  it('mesmo seed → mesmo andar', () => {
    expect(generateFloor(Rng.fromSeed(123))).toEqual(generateFloor(Rng.fromSeed(123)));
  });

  it('seeds diferentes → andares diferentes', () => {
    expect(generateFloor(Rng.fromSeed(1)).map).not.toEqual(generateFloor(Rng.fromSeed(2)).map);
  });

  it.each(SEEDS)('seed %i: andar conexo, escada alcançável, borda fechada', (seed) => {
    const f = generateFloor(Rng.fromSeed(seed));
    const { map } = f;
    expect(map.width).toBe(DUNGEON.width);
    expect(map.height).toBe(DUNGEON.height);

    // Tudo que é chão está ligado ao início
    const seen = reachable(map, f.start);
    expect(seen.size).toBe(walkableCount(map));
    expect(seen.has(pointKey(f.stairs))).toBe(true);

    // Exatamente uma escada, fora da sala inicial e longe do início
    expect(map.tiles.filter((t) => t === TileType.STAIRS)).toHaveLength(1);
    expect(getTile(map, f.stairs)).toBe(TileType.STAIRS);
    expect(roomContains(f.rooms[f.startRoom]!, f.stairs)).toBe(false);
    expect(samePoint(f.start, f.stairs)).toBe(false);

    // Início dentro da sala inicial
    expect(roomContains(f.rooms[f.startRoom]!, f.start)).toBe(true);

    // Borda do mapa sempre parede
    for (let x = 0; x < map.width; x++) {
      expect(getTile(map, { x, y: 0 })).toBe(TileType.WALL);
      expect(getTile(map, { x, y: map.height - 1 })).toBe(TileType.WALL);
    }
    for (let y = 0; y < map.height; y++) {
      expect(getTile(map, { x: 0, y })).toBe(TileType.WALL);
      expect(getTile(map, { x: map.width - 1, y })).toBe(TileType.WALL);
    }
  });

  it('salas não se sobrepõem e respeitam o tamanho mínimo', () => {
    for (const seed of SEEDS) {
      const { rooms } = generateFloor(Rng.fromSeed(seed));
      for (const r of rooms) {
        expect(r.w).toBeGreaterThanOrEqual(DUNGEON.minRoomSize);
        expect(r.h).toBeGreaterThanOrEqual(DUNGEON.minRoomSize);
      }
      for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
          const a = rooms[i]!;
          const b = rooms[j]!;
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap).toBe(false);
        }
      }
    }
  });

  it('rende entre 5 e 14 salas por andar', () => {
    const counts = SEEDS.map((s) => generateFloor(Rng.fromSeed(s)).rooms.length);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(5);
    expect(Math.max(...counts)).toBeLessThanOrEqual(14);
  });
});
