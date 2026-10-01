import { KILL_HEAL, MANA_PER_KILL, POTION_DROP_CHANCE } from '../balance';
import type { ItemId } from '../data/items';
import { LOOT_TABLES } from '../data/lootTables';
import type { Entity } from '../entities/Entity';
import type { CoreEvent } from '../events';
import { cardTotal, gainXp, healEntity, relicEffect } from '../hero';
import { receiveItem } from '../items/Inventory';
import { rollLoot } from '../items/LootTable';
import type { Rng } from '../rng';
import { getPlayer, type RunState } from '../run';

/**
 * Tudo que um kill do player rende ("grind com retorno real", handoff §6):
 * gold + XP, mana, passiva do Knight (+2 HP), loot da tabela do monstro e poções.
 * Loot vai direto pro inventário (sem item no chão no MVP).
 */
export function grantKillRewards(state: RunState, victim: Entity, rng: Rng, events: CoreEvent[]): void {
  const { hero } = state;
  const player = getPlayer(state);

  // Invocado pelo boss: só metade do XP — sem gold, loot, mana nem cura
  // (decisão do Felipe, Marco 4: não dá pra farmar o boss)
  if (victim.summoned) {
    const xp = Math.floor((victim.reward?.xp ?? 0) / 2);
    if (xp > 0) {
      events.push({ type: 'rewarded', xp, gold: 0 });
      gainXp(hero, player, xp, events);
    }
    return;
  }

  if (victim.reward) {
    // Carta Caçador: gold e XP extras por kill; relíquia Ídolo Dourado: +50% de gold
    const baseGold =
      Math.max(1, rng.int(victim.reward.goldMin, victim.reward.goldMax)) + cardTotal(hero, 'hunter', (e) => e.gold);
    const gold = Math.ceil(baseGold * (1 + (relicEffect(hero, 'gold-pct')?.pct ?? 0)));
    const xp = victim.reward.xp + cardTotal(hero, 'hunter', (e) => e.xp);
    hero.gold += gold;
    events.push({ type: 'rewarded', xp, gold });
    gainXp(hero, player, xp, events);
  }

  // Carta Sede de Sangue: mana extra por kill
  const manaBefore = hero.mana;
  const manaGain = MANA_PER_KILL + cardTotal(hero, 'bloodthirst', (e) => e.mana);
  hero.mana = Math.min(hero.maxMana, hero.mana + manaGain);
  if (hero.mana > manaBefore) {
    events.push({ type: 'mana-restored', amount: hero.mana - manaBefore, mana: hero.mana });
  }

  // Passiva do Knight + relíquia Pedra de Sangue (% do HP max)
  const stonePct = relicEffect(hero, 'kill-heal-pct')?.pct ?? 0;
  const healed = healEntity(player, KILL_HEAL + Math.round(player.maxHp * stonePct));
  if (healed > 0) {
    events.push({ type: 'healed', entityId: player.id, amount: healed, hp: player.hp, source: 'passive' });
  }

  const drops: ItemId[] = victim.loot ? rollLoot(LOOT_TABLES[victim.loot], rng) : [];
  if (rng.chance(POTION_DROP_CHANCE.hpPotion)) drops.push('hpPotion');
  if (rng.chance(POTION_DROP_CHANCE.manaPotion)) drops.push('manaPotion');
  for (const id of drops) receiveItem(hero, player, id, events);
}
