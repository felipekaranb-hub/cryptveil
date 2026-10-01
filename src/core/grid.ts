/**
 * Grid lógico do jogo. Só coordenadas de tile — nada de pixel aqui.
 * A conversão tile↔pixel mora na view (src/view/coords.ts), porque
 * pixel é assunto de renderização.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Direções ortogonais. Movimento e bump attack são 4-direções (handoff §2.10). */
export type Direction = 'N' | 'S' | 'E' | 'W';

export const DIRECTION_DELTAS: Readonly<Record<Direction, Point>> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
};

export const DIRECTIONS: readonly Direction[] = ['N', 'S', 'E', 'W'];

export function step(p: Point, dir: Direction): Point {
  const d = DIRECTION_DELTAS[dir];
  return { x: p.x + d.x, y: p.y + d.y };
}

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Adjacente nas 4 direções (não conta diagonal nem o próprio tile). */
export function isAdjacent4(a: Point, b: Point): boolean {
  return manhattan(a, b) === 1;
}

/** Os 4 vizinhos ortogonais — base do Berserk (AoE nos 4 tiles adjacentes). */
export function neighbors4(p: Point): Point[] {
  return DIRECTIONS.map((d) => step(p, d));
}

export function inBounds(p: Point, width: number, height: number): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < width && p.y < height;
}

/** Chave estável pra Set/Map (fog of war, ocupação de tiles). */
export function pointKey(p: Point): string {
  return `${p.x},${p.y}`;
}
