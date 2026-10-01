import { getItem, type ItemId } from '../data/items';
import type { Entity } from '../entities/Entity';
import type { CoreEvent } from '../events';
import { refreshPlayerStats, type HeroState } from '../hero';
import { canEquip, equipmentScore } from './Item';

/**
 * Item novo chega no player. Auto-equip (provisório até a InventoryUI do
 * Marco 3): se o player pode usar e é melhor (ATK+DEF) que o do slot, veste
 * e o antigo vai pro inventário. Senão vai direto pro inventário.
 */
export function receiveItem(hero: HeroState, player: Entity, id: ItemId, events: CoreEvent[]): void {
  const item = getItem(id);
  if (canEquip(item, hero.vocation)) {
    const currentId = hero.equipment[item.slot];
    const current = currentId ? getItem(currentId) : undefined;
    const currentScore = current?.kind === 'equipment' ? equipmentScore(current) : -1;
    if (equipmentScore(item) > currentScore) {
      if (currentId) hero.bag.push(currentId);
      hero.equipment[item.slot] = id;
      refreshPlayerStats(hero, player);
      events.push({ type: 'looted', itemId: id, equipped: true });
      return;
    }
  }
  hero.bag.push(id);
  events.push({ type: 'looted', itemId: id, equipped: false });
}

/** Tira uma unidade do inventário. false se não tinha. */
export function takeFromBag(hero: HeroState, id: ItemId): boolean {
  const i = hero.bag.indexOf(id);
  if (i < 0) return false;
  hero.bag.splice(i, 1);
  return true;
}
