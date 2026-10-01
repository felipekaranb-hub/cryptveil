import { describe, expect, it } from 'vitest';
import { createTestRoom, getTile, isWalkable, setTile, TileType } from './dungeon/DungeonMap';
import { bfsFirstStep } from './pathfinding';

describe('DungeonMap', () => {
  it('sala de teste tem borda de parede e interior de chão', () => {
    const map = createTestRoom(15, 11);
    expect(getTile(map, { x: 0, y: 0 })).toBe(TileType.WALL);
    expect(getTile(map, { x: 14, y: 10 })).toBe(TileType.WALL);
    expect(getTile(map, { x: 7, y: 0 })).toBe(TileType.WALL);
    expect(getTile(map, { x: 1, y: 1 })).toBe(TileType.FLOOR);
    expect(getTile(map, { x: 13, y: 9 })).toBe(TileType.FLOOR);
  });

  it('fora do mapa conta como parede', () => {
    const map = createTestRoom(15, 11);
    expect(isWalkable(map, { x: -1, y: 5 })).toBe(false);
    expect(isWalkable(map, { x: 15, y: 5 })).toBe(false);
  });
});

describe('bfsFirstStep', () => {
  it('vai direto quando o caminho está livre', () => {
    const map = createTestRoom(15, 11);
    const dir = bfsFirstStep({ x: 11, y: 5 }, { x: 3, y: 5 }, (p) => isWalkable(map, p));
    expect(dir).toBe('W');
  });

  it('contorna uma parede no meio do caminho', () => {
    const map = createTestRoom(15, 11);
    // Muro vertical em x=7, de y=1 a y=8; passagem só em y=9
    for (let y = 1; y <= 8; y++) setTile(map, { x: 7, y }, TileType.WALL);
    const dir = bfsFirstStep({ x: 8, y: 2 }, { x: 6, y: 2 }, (p) => isWalkable(map, p));
    // O caminho mais curto desce até a passagem
    expect(dir).toBe('S');
  });

  it('devolve null quando não há caminho', () => {
    const map = createTestRoom(15, 11);
    for (let y = 1; y <= 9; y++) setTile(map, { x: 7, y }, TileType.WALL);
    expect(bfsFirstStep({ x: 8, y: 5 }, { x: 3, y: 5 }, (p) => isWalkable(map, p))).toBeNull();
  });

  it('chega no alvo mesmo que o tile do alvo seja "bloqueado" (é o player)', () => {
    const dir = bfsFirstStep({ x: 4, y: 5 }, { x: 3, y: 5 }, () => false);
    expect(dir).toBe('W');
  });
});
