import { inBounds, type Point } from '../grid';

/** Tipos de tile. Número pequeno pra o mapa serializar compacto. */
export const TileType = {
  FLOOR: 0,
  WALL: 1,
  /** Escada pra baixo: pisar nela desce de andar. */
  STAIRS: 2,
  /** Centro da Training Room: pisar oferece +2 ATK ou +2 DEF, uma vez. */
  TRAINING: 3,
} as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

/** Mapa como dado puro (vai inteiro pro save). tiles[y * width + x]. */
export interface DungeonMap {
  readonly width: number;
  readonly height: number;
  readonly tiles: TileType[];
}

export function getTile(map: DungeonMap, p: Point): TileType {
  if (!inBounds(p, map.width, map.height)) return TileType.WALL;
  return map.tiles[p.y * map.width + p.x] ?? TileType.WALL;
}

/** Fora do mapa conta como parede. Escada e Training são chão (dá pra pisar). */
export function isWalkable(map: DungeonMap, p: Point): boolean {
  return getTile(map, p) !== TileType.WALL;
}

/** Mapa todo de parede; o gerador escava salas e corredores. */
export function createFilledMap(width: number, height: number): DungeonMap {
  return { width, height, tiles: new Array<TileType>(width * height).fill(TileType.WALL) };
}

/** Sala fixa de teste (Marco 1): borda de parede, interior de chão. */
export function createTestRoom(width: number, height: number): DungeonMap {
  const tiles: TileType[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      tiles.push(border ? TileType.WALL : TileType.FLOOR);
    }
  }
  return { width, height, tiles };
}

/** Utilitário de teste/debug: coloca um tile. */
export function setTile(map: DungeonMap, p: Point, tile: TileType): void {
  if (inBounds(p, map.width, map.height)) map.tiles[p.y * map.width + p.x] = tile;
}
