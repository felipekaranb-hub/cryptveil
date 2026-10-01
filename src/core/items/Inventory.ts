import { getItem, type ItemId } from '../data/items';
import type { Entity } from '../entities/Entity';
import type { CoreEvent } from '../events';
import { updatePlayerStats, type HeroState } from '../hero';
import { canEquip, equipmentScore, type EquipSlot } from './Item';

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
      events.push({ type: 'looted', itemId: id, equipped: true });
      updatePlayerStats(hero, player, events);
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

export type EquipFailure = 'no-item' | 'cannot-equip';

/**
 * Inventário (Marco 3): veste um item da mochila. O que estava no slot volta
 * pra mochila. Falha sem mexer em nada se não tem o item ou a vocação não usa.
 */
export function equipFromBag(hero: HeroState, player: Entity, id: ItemId, events: CoreEvent[]): true | EquipFailure {
  if (!hero.bag.includes(id)) return 'no-item';
  const item = getItem(id);
  if (!canEquip(item, hero.vocation)) return 'cannot-equip';
  takeFromBag(hero, id);
  const currentId = hero.equipment[item.slot];
  if (currentId) hero.bag.push(currentId);
  hero.equipment[item.slot] = id;
  events.push({ type: 'equipped', itemId: id });
  updatePlayerStats(hero, player, events);
  return true;
}

/** Tira o item do slot e guarda na mochila. */
export function unequipSlot(hero: HeroState, player: Entity, slot: EquipSlot, events: CoreEvent[]): true | 'empty-slot' {
  const id = hero.equipment[slot];
  if (!id) return 'empty-slot';
  delete hero.equipment[slot];
  hero.bag.push(id);
  events.push({ type: 'unequipped', itemId: id });
  updatePlayerStats(hero, player, events);
  return true;
}
