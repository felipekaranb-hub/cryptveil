import { ENEMIES_PER_ROOM, PLACEHOLDER_ENEMY_GROWTH } from '../balance';
import { ENTITY_TEMPLATES } from '../data/entities';
import type { LootTableId } from '../data/lootTables';
import { createEntity, type Entity, type EntityTemplate } from '../entities/Entity';
import { pointKey, type Point } from '../grid';
import type { Rng } from '../rng';
import { isWalkable, type DungeonMap } from './DungeonMap';
import type { GeneratedFloor } from './DungeonGenerator';
import type { Room } from './Room';

/**
 * PROVISÓRIO (Marco 2): Goblin dummy mais forte a cada andar, com XP, gold
 * e loot crescendo junto. No Marco 4 vira sorteio de Rat/Skeleton/Goblin/Orc.
 */
export function placeholderEnemyFor(floor: number): EntityTemplate {
  const base = ENTITY_TEMPLATES.goblinDummy;
  const g = PLACEHOLDER_ENEMY_GROWTH;
  const loot: LootTableId = floor <= 1 ? 'placeholderFloor1' : floor === 2 ? 'placeholderFloor2' : 'placeholderFloor3';
  return {
    ...base,
    maxHp: base.maxHp + g.hpPerFloor * floor,
    atk: base.atk + g.atkPerFloor * floor,
    reward: {
      xp: base.reward.xp + g.xpPerFloor * floor,
      goldMin: base.reward.goldMin,
      goldMax: base.reward.goldMax + g.goldPerFloor * floor,
    },
    loot,
  };
}

/**
 * Monstros do andar: 0–2 por sala, nunca na sala inicial, na escada nem nas
 * salas de `skipRooms` (Training Room). Cada um lembra a sala onde nasceu.
 */
export function spawnEnemies(
  floorNumber: number,
  floor: GeneratedFloor,
  rng: Rng,
  skipRooms: readonly number[] = [],
): Entity[] {
  const template = placeholderEnemyFor(floorNumber);
  const taken = new Set<string>([pointKey(floor.start), pointKey(floor.stairs)]);
  const enemies: Entity[] = [];

  floor.rooms.forEach((room, i) => {
    if (i === floor.startRoom || skipRooms.includes(i)) return;
    const count = rng.int(ENEMIES_PER_ROOM.min, ENEMIES_PER_ROOM.max);
    for (let n = 0; n < count; n++) {
      const pos = freeTileIn(room, floor.map, taken, rng);
      if (!pos) break;
      taken.add(pointKey(pos));
      const enemy = createEntity(`e${floorNumber}-${enemies.length + 1}`, template, pos);
      enemy.homeRoom = i;
      enemies.push(enemy);
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
