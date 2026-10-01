import { describe, expect, it } from 'vitest';
import { inBounds, isAdjacent4, manhattan, neighbors4, pointKey, step } from './grid';

describe('grid', () => {
  it('step anda uma casa em cada direção', () => {
    expect(step({ x: 5, y: 5 }, 'N')).toEqual({ x: 5, y: 4 });
    expect(step({ x: 5, y: 5 }, 'S')).toEqual({ x: 5, y: 6 });
    expect(step({ x: 5, y: 5 }, 'E')).toEqual({ x: 6, y: 5 });
    expect(step({ x: 5, y: 5 }, 'W')).toEqual({ x: 4, y: 5 });
  });

  it('manhattan e adjacência 4-direções', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
    expect(isAdjacent4({ x: 2, y: 2 }, { x: 2, y: 3 })).toBe(true);
    expect(isAdjacent4({ x: 2, y: 2 }, { x: 3, y: 3 })).toBe(false); // diagonal não conta
    expect(isAdjacent4({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(false);
  });

  it('neighbors4 devolve os 4 tiles do Berserk', () => {
    const n = neighbors4({ x: 1, y: 1 }).map(pointKey).sort();
    expect(n).toEqual(['0,1', '1,0', '1,2', '2,1']);
  });

  it('inBounds respeita o viewport 15×11', () => {
    expect(inBounds({ x: 0, y: 0 }, 15, 11)).toBe(true);
    expect(inBounds({ x: 14, y: 10 }, 15, 11)).toBe(true);
    expect(inBounds({ x: 15, y: 10 }, 15, 11)).toBe(false);
    expect(inBounds({ x: -1, y: 0 }, 15, 11)).toBe(false);
  });
});
