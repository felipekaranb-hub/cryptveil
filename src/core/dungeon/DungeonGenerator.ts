import { DUNGEON } from '../balance';
import { DIRECTIONS, manhattan, pointKey, step, type Point } from '../grid';
import type { Rng } from '../rng';
import { createFilledMap, getTile, setTile, TileType, type DungeonMap } from './DungeonMap';
import { roomCenter, roomContains, type Room } from './Room';

export interface GeneratedFloor {
  readonly map: DungeonMap;
  readonly rooms: Room[];
  /** Onde o player aparece (centro da sala inicial). */
  readonly start: Point;
  readonly stairs: Point;
  /** Índice da sala inicial em `rooms`. */
  readonly startRoom: number;
}

export interface GeneratorConfig {
  readonly width: number;
  readonly height: number;
  readonly minLeaf: number;
  readonly minRoomSize: number;
  readonly maxRoomSize: number;
}

/** Nó da árvore BSP: um retângulo do mapa, dividido em dois ou com uma sala. */
interface Leaf {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  children?: readonly [Leaf, Leaf];
  room?: Room;
}

/**
 * Gera um andar com BSP:
 * 1. divide o mapa recursivamente em retângulos (folhas);
 * 2. escava uma sala dentro de cada folha, com pelo menos 1 de parede em volta;
 * 3. liga as duas metades de cada divisão com um corredor em L entre as
 *    salas mais próximas — como toda divisão é ligada, o andar é conexo;
 * 4. player na sala sorteada, escada no ponto de sala mais distante a pé.
 *
 * Determinístico: mesmo estado de Rng → mesmo andar.
 */
export function generateFloor(rng: Rng, config: GeneratorConfig = DUNGEON): GeneratedFloor {
  const map = createFilledMap(config.width, config.height);
  const root: Leaf = { x: 0, y: 0, w: config.width, h: config.height };

  split(root, rng, config);
  const rooms: Room[] = [];
  carveRooms(root, rng, config, map, rooms);
  connect(root, rng, map);

  const startRoom = rng.int(0, rooms.length - 1);
  const start = roomCenter(rooms[startRoom] as Room);
  const stairs = farthestRoomTile(map, rooms, startRoom, start);
  setTile(map, stairs, TileType.STAIRS);

  return { map, rooms, start, stairs, startRoom };
}

function split(leaf: Leaf, rng: Rng, cfg: GeneratorConfig): void {
  const canCutH = leaf.h >= cfg.minLeaf * 2; // corte horizontal: cima/baixo
  const canCutV = leaf.w >= cfg.minLeaf * 2; // corte vertical: esquerda/direita
  if (!canCutH && !canCutV) return;

  // Prefere cortar o lado mais comprido, pra não gerar faixas finas
  let horizontal: boolean;
  if (!canCutV) horizontal = true;
  else if (!canCutH) horizontal = false;
  else if (leaf.w / leaf.h >= 1.25) horizontal = false;
  else if (leaf.h / leaf.w >= 1.25) horizontal = true;
  else horizontal = rng.chance(0.5);

  const size = horizontal ? leaf.h : leaf.w;
  const cut = rng.int(cfg.minLeaf, size - cfg.minLeaf);
  const a: Leaf = horizontal
    ? { x: leaf.x, y: leaf.y, w: leaf.w, h: cut }
    : { x: leaf.x, y: leaf.y, w: cut, h: leaf.h };
  const b: Leaf = horizontal
    ? { x: leaf.x, y: leaf.y + cut, w: leaf.w, h: leaf.h - cut }
    : { x: leaf.x + cut, y: leaf.y, w: leaf.w - cut, h: leaf.h };
  leaf.children = [a, b];
  split(a, rng, cfg);
  split(b, rng, cfg);
}

function carveRooms(leaf: Leaf, rng: Rng, cfg: GeneratorConfig, map: DungeonMap, rooms: Room[]): void {
  if (leaf.children) {
    for (const child of leaf.children) carveRooms(child, rng, cfg, map, rooms);
    return;
  }
  // 1 tile de parede de cada lado dentro da folha: salas vizinhas nunca encostam
  const w = rng.int(cfg.minRoomSize, Math.min(cfg.maxRoomSize, leaf.w - 2));
  const h = rng.int(cfg.minRoomSize, Math.min(cfg.maxRoomSize, leaf.h - 2));
  const x = rng.int(leaf.x + 1, leaf.x + leaf.w - 1 - w);
  const y = rng.int(leaf.y + 1, leaf.y + leaf.h - 1 - h);
  const room: Room = { x, y, w, h };
  leaf.room = room;
  rooms.push(room);
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) setTile(map, { x: tx, y: ty }, TileType.FLOOR);
  }
}

function collectRooms(leaf: Leaf, out: Room[] = []): Room[] {
  if (leaf.room) out.push(leaf.room);
  if (leaf.children) for (const c of leaf.children) collectRooms(c, out);
  return out;
}

/** Liga as duas metades de cada divisão, de baixo pra cima. */
function connect(leaf: Leaf, rng: Rng, map: DungeonMap): void {
  if (!leaf.children) return;
  const [a, b] = leaf.children;
  connect(a, rng, map);
  connect(b, rng, map);

  // O par de salas mais próximo entre as duas metades: corredores curtos
  let best: { from: Point; to: Point; dist: number } | null = null;
  for (const ra of collectRooms(a)) {
    for (const rb of collectRooms(b)) {
      const from = roomCenter(ra);
      const to = roomCenter(rb);
      const dist = manhattan(from, to);
      if (!best || dist < best.dist) best = { from, to, dist };
    }
  }
  if (best) carveCorridor(map, best.from, best.to, rng.chance(0.5));
}

/** Corredor em L. Fica dentro do retângulo entre os dois centros, nunca na borda. */
function carveCorridor(map: DungeonMap, from: Point, to: Point, horizontalFirst: boolean): void {
  const corner = horizontalFirst ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  carveLine(map, from, corner);
  carveLine(map, corner, to);
}

function carveLine(map: DungeonMap, from: Point, to: Point): void {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  let p = from;
  for (;;) {
    if (getTile(map, p) === TileType.WALL) setTile(map, p, TileType.FLOOR);
    if (p.x === to.x && p.y === to.y) return;
    p = { x: p.x + dx, y: p.y + dy };
  }
}

/**
 * Tile de sala (não corredor, não a sala inicial) mais longe do início
 * andando — é onde vai a escada, então o player sempre atravessa o andar.
 */
function farthestRoomTile(map: DungeonMap, rooms: readonly Room[], startRoom: number, start: Point): Point {
  const dist = new Map<string, number>([[pointKey(start), 0]]);
  const queue: Point[] = [start];
  let best = start;
  let bestDist = -1;
  const startR = rooms[startRoom] as Room;

  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] as Point;
    const d = dist.get(pointKey(cur)) as number;
    if (d > bestDist && !roomContains(startR, cur) && rooms.some((r) => roomContains(r, cur))) {
      best = cur;
      bestDist = d;
    }
    for (const dir of DIRECTIONS) {
      const n = step(cur, dir);
      if (getTile(map, n) === TileType.WALL || dist.has(pointKey(n))) continue;
      dist.set(pointKey(n), d + 1);
      queue.push(n);
    }
  }
  return best;
}
