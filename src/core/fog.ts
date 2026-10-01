import { CORRIDOR_VISION } from './balance';
import { isWalkable, TileType } from './dungeon/DungeonMap';
import { relicEffect } from './hero';
import { roomIndexAt } from './dungeon/Room';
import { DIRECTIONS, inBounds, step, type Point } from './grid';
import type { RunState } from './run';

/**
 * Fog of war (Marco 3). Tiles são índices `y * width + x` (JSON puro no save).
 * - Visível: o que o Knight vê AGORA (monstro só aparece aqui).
 * - Explorado: tudo que já foi visível neste andar (minimapa e mapa escurecido).
 * Só a view usa: regras de combate e IA não olham a fog.
 */
export function visibleTiles(state: RunState): Set<number> {
  const { map } = state;
  // Sem getPlayer: run.ts importa este módulo (evita import circular)
  const player = state.entities.find((e) => e.id === state.playerId)?.pos;
  if (!player) return new Set();
  const seen = new Set<number>();
  const add = (p: Point): void => {
    if (inBounds(p, map.width, map.height)) seen.add(p.y * map.width + p.x);
  };

  const roomIndex = roomIndexAt(state.rooms, player);
  const room = state.rooms[roomIndex];
  if (room) {
    // Sala inteira + o anel de parede em volta (as portas estão nele)
    for (let y = room.y - 1; y <= room.y + room.h; y++) {
      for (let x = room.x - 1; x <= room.x + room.w; x++) add({ x, y });
    }
    return seen;
  }

  // Corredor: BFS pelo chão até CORRIDOR_VISION, mais as paredes em volta do que viu
  let frontier: Point[] = [player];
  add(player);
  const floor = new Set<number>([player.y * map.width + player.x]);
  // Relíquia Olho do Vigia: enxerga mais longe no corredor
  const vision = relicEffect(state.hero, 'watcher')?.vision ?? CORRIDOR_VISION;
  for (let d = 0; d < vision; d++) {
    const next: Point[] = [];
    for (const p of frontier) {
      for (const dir of DIRECTIONS) {
        const q = step(p, dir);
        const key = q.y * map.width + q.x;
        if (floor.has(key) || !isWalkable(map, q)) continue;
        floor.add(key);
        add(q);
        next.push(q);
      }
    }
    frontier = next;
  }
  for (const key of floor) {
    const p = { x: key % map.width, y: Math.floor(key / map.width) };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add({ x: p.x + dx, y: p.y + dy });
  }
  return seen;
}

/** Junta o que está visível agora no explorado do andar. Idempotente. */
export function revealAround(state: RunState): void {
  const explored = new Set(state.explored);
  const before = explored.size;
  for (const key of visibleTiles(state)) explored.add(key);
  if (explored.size !== before) state.explored = [...explored].sort((a, b) => a - b);
}

export function isExplored(state: RunState, p: Point): boolean {
  return state.explored.includes(p.y * state.map.width + p.x);
}

/**
 * Relíquia Olho do Vigia: a escada do andar (ou o lugar dela, no andar do
 * boss) entra no explorado e aparece no minimapa. Chamado ao chegar no
 * andar e ao comprar a relíquia.
 */
export function revealStairsIfWatcher(state: RunState): void {
  if (!relicEffect(state.hero, 'watcher')) return;
  const { map } = state;
  const stairs = state.hiddenStairs ?? (() => {
    const i = map.tiles.indexOf(TileType.STAIRS);
    return i < 0 ? null : { x: i % map.width, y: Math.floor(i / map.width) };
  })();
  if (!stairs) return;
  const key = stairs.y * map.width + stairs.x;
  if (!state.explored.includes(key)) state.explored = [...state.explored, key].sort((a, b) => a - b);
}
