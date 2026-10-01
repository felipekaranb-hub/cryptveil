import type { Point } from '../grid';

/** Sala retangular. x/y/w/h cobrem só o CHÃO (as paredes ficam em volta). */
export interface Room {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function roomCenter(r: Room): Point {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

export function roomContains(r: Room, p: Point): boolean {
  return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;
}

/** Índice da sala que contém o ponto, ou -1 (corredor). */
export function roomIndexAt(rooms: readonly Room[], p: Point): number {
  return rooms.findIndex((r) => roomContains(r, p));
}
