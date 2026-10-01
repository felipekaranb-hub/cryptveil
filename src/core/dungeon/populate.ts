import { ENEMIES_PER_ROOM, PLACEHOLDER_ENEMY_GROWTH } from '../balance';
import { ENTITY_TEMPLATES } from '../data/entities';
import { createEntity, type Entity, type EntityTemplate } from '../entities/Entity';
import { pointKey, type Point } from '../grid';
import type { Rng } from '../rng';
import { isWalkable, type DungeonMap } from './DungeonMap';
import type { GeneratedFloor } from './DungeonGenerator';
import type { Room } from './Room';

/**
 * PROVISÓRIO (Marco 2): Goblin dummy mais forte a cada andar.
 * No Marco 4 vira sorteio de Rat/Skeleton/Goblin/Orc por andar.
 */
export function placeholderEnemyFor(floor: number): EntityTemplate {
  const base = ENTITY_TEMPLATES.goblinDummy;
  return {
    ...base,
    maxHp: base.maxHp + PLACEHOLDER_ENEMY_GROWTH.hpPerFloor * floor,
    atk: base.atk + PLACEHOLDER_ENEMY_GROWTH.atkPerFloor * floor,
  };
}

/** Monstros do andar: 0–2 por sala, nunca na sala inicial nem na escada. */
export function spawnEnemies(floorNumber: number, floor: GeneratedFloor, rng: Rng): Entity[] {
  const template = placeholderEnemyFor(floorNumber);
  const taken = new Set<string>([pointKey(floor.start), pointKey(floor.stairs)]);
  const enemies: Entity[] = [];

  floor.rooms.forEach((room, i) => {
    if (i === floor.startRoom) return;
    const count = rng.int(ENEMIES_PER_ROOM.min, ENEMIES_PER_ROOM.max);
    for (let n = 0; n < count; n++) {
      const pos = freeTileIn(room, floor.map, taken, rng);
      if (!pos) break;
      taken.add(pointKey(pos));
      enemies.push(createEntity(`e${floorNumber}-${enemies.length + 1}`, template, pos));
    }
  });
  return enemies;
}

function freeTileIn(room: Room, map: DungeonMap, taken: Set<string>, rng: Rng): Point | null {
  for (let tries = 0; tries < 20; tries++) {
    const p = { x: rng.int(room.x, room.x + room.w - 1), y: rng.int(room.y, room.y + room.h - 1) };
    if (isWalkable(map, p) && !taken.has(pointKey(p))) return p;
  }
  return null;
}
