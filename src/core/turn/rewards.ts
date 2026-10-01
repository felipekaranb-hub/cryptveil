import { KILL_HEAL, POTION_DROP_CHANCE } from '../balance';
import type { ItemId } from '../data/items';
import { LOOT_TABLES } from '../data/lootTables';
import type { Entity } from '../entities/Entity';
import type { CoreEvent } from '../events';
import { gainXp, healEntity } from '../hero';
import { receiveItem } from '../items/Inventory';
import { rollLoot } from '../items/LootTable';
import type { Rng } from '../rng';
import { getPlayer, type RunState } from '../run';

/**
 * Tudo que um kill do player rende ("grind com retorno real", handoff §6):
 * gold + XP, passiva do Knight (+2 HP), loot da tabela do monstro e poções.
 * Loot vai direto pro inventário (sem item no chão no MVP).
 */
export function grantKillRewards(state: RunState, victim: Entity, rng: Rng, events: CoreEvent[]): void {
  const { hero } = state;
  const player = getPlayer(state);

  if (victim.reward) {
    const gold = Math.max(1, rng.int(victim.reward.goldMin, victim.reward.goldMax));
    hero.gold += gold;
    events.push({ type: 'rewarded', xp: victim.reward.xp, gold });
    gainXp(hero, player, victim.reward.xp, events);
  }

  const healed = healEntity(player, KILL_HEAL);
  if (healed > 0) {
    events.push({ type: 'healed', entityId: player.id, amount: healed, hp: player.hp, source: 'passive' });
  }

  const drops: ItemId[] = victim.loot ? rollLoot(LOOT_TABLES[victim.loot], rng) : [];
  if (rng.chance(POTION_DROP_CHANCE.hpPotion)) drops.push('hpPotion');
  if (rng.chance(POTION_DROP_CHANCE.manaPotion)) drops.push('manaPotion');
  for (const id of drops) receiveItem(hero, player, id, events);
}
