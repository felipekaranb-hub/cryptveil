import { ROOMS_PER_TRAINING, TRAINING_BONUS } from '../balance';
import { roomIndexAt } from '../dungeon/Room';
import { setTile, TileType } from '../dungeon/DungeonMap';
import { isAlive } from '../entities/Entity';
import type { CoreEvent } from '../events';
import { updatePlayerStats } from '../hero';
import { getPlayer, type RunState } from '../run';

/**
 * "Sala explorada" (decidido no Marco 2b): o player entrou nela E todos os
 * monstros que nasceram nela morreram. Sala sem monstro conta ao entrar.
 * A cada ROOMS_PER_TRAINING salas, o próximo andar ganha uma Training Room.
 */
export function updateRoomProgress(state: RunState, events: CoreEvent[]): void {
  const { hero } = state;
  const here = roomIndexAt(state.rooms, getPlayer(state).pos);
  if (here >= 0 && !state.visitedRooms.includes(here)) state.visitedRooms.push(here);

  for (const room of state.visitedRooms) {
    if (state.clearedRooms.includes(room)) continue;
    const anyAlive = state.entities.some((e) => e.kind === 'enemy' && isAlive(e) && e.homeRoom === room);
    if (anyAlive) continue;
    state.clearedRooms.push(room);
    hero.roomsExplored += 1;
    const trainingEarned = hero.roomsExplored % ROOMS_PER_TRAINING === 0;
    if (trainingEarned) hero.trainingPending += 1;
    events.push({ type: 'room-cleared', explored: hero.roomsExplored, trainingEarned });
  }
}

/** Escolha única da Training Room: 0 = +ATK, 1 = +DEF. O tile vira chão. */
export function applyTrainingChoice(state: RunState, index: number, events: CoreEvent[]): boolean {
  if (index !== 0 && index !== 1) return false;
  const { hero } = state;
  const player = getPlayer(state);
  const stat = index === 0 ? 'atk' : 'def';
  if (stat === 'atk') hero.trainedAtk += TRAINING_BONUS;
  else hero.trainedDef += TRAINING_BONUS;
  setTile(state.map, player.pos, TileType.FLOOR);
  state.prompt = null;
  events.push({ type: 'trained', stat, amount: TRAINING_BONUS });
  updatePlayerStats(hero, player, events);
  return true;
}
