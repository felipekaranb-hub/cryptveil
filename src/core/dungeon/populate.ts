import { FINAL_FLOOR, FLOOR_SPAWNS } from '../balance';
import { ENTITY_TEMPLATES, type MonsterId } from '../data/entities';
import { createEntity, type Entity } from '../entities/Entity';
import { pointKey, type Point } from '../grid';
import type { Rng } from '../rng';
import { isWalkable, type DungeonMap } from './DungeonMap';
import type { GeneratedFloor } from './DungeonGenerator';
import type { Room } from './Room';

/** Configuração do andar (andares além da tabela usam a do último). */
function spawnsFor(floor: number): (typeof FLOOR_SPAWNS)[number] {
  const last = FLOOR_SPAWNS[FINAL_FLOOR];
  return FLOOR_SPAWNS[Math.min(Math.max(floor, 1), FINAL_FLOOR)] ?? (last as (typeof FLOOR_SPAWNS)[number]);
}

/** Sorteia um monstro pelos pesos do andar. Ordem fixa das chaves → determinístico pelo Rng. */
export function rollMonster(floor: number, rng: Rng): MonsterId {
  const entries = Object.entries(spawnsFor(floor).weights) as [MonsterId, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng.next() * total;
  for (const [id, w] of entries) {
    if (roll < w) return id;
    roll -= w;
  }
  return (entries[entries.length - 1] as [MonsterId, number])[0];
}

/**
 * Monstros do andar (Marco 4): quantidade por sala e mistura vêm de
 * FLOOR_SPAWNS. Nunca na sala inicial, na escada nem nas salas de
 * `skipRooms` (Training Room, mercador, sala do boss). Cada um lembra a sala
 * onde nasceu.
 */
export function spawnEnemies(
  floorNumber: number,
  floor: GeneratedFloor,
  rng: Rng,
  skipRooms: readonly number[] = [],
): Entity[] {
  const { perRoom } = spawnsFor(floorNumber);
  const taken = new Set<string>([pointKey(floor.start), pointKey(floor.stairs)]);
  const enemies: Entity[] = [];

  floor.rooms.forEach((room, i) => {
    if (i === floor.startRoom || skipRooms.includes(i)) return;
    const count = rng.int(perRoom.min, perRoom.max);
    for (let n = 0; n < count; n++) {
      const pos = freeTileIn(room, floor.map, taken, rng);
      if (!pos) break;
      taken.add(pointKey(pos));
      const template = ENTITY_TEMPLATES[rollMonster(floorNumber, rng)];
      const enemy = createEntity(`e${floorNumber}-${enemies.length + 1}`, template, pos);
      enemy.homeRoom = i;
      enemies.push(enemy);
    }
  });
  return enemies;
}

/** Orc Warlord no lugar da escada (ela só aparece quando ele morre). */
export function spawnBoss(floorNumber: number, pos: Point, homeRoom: number): Entity {
  const boss = createEntity(`boss${floorNumber}`, ENTITY_TEMPLATES.orcWarlord, pos);
  boss.homeRoom = homeRoom;
  return boss;
}

function freeTileIn(room: Room, map: DungeonMap, taken: Set<string>, rng: Rng): Point | null {
  for (let tries = 0; tries < 20; tries++) {
    const p = { x: rng.int(room.x, room.x + room.w - 1), y: rng.int(room.y, room.y + room.h - 1) };
    if (isWalkable(map, p) && !taken.has(pointKey(p))) return p;
  }
  return null;
}
