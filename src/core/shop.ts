import { SHOP } from './balance';
import { getItem, type ItemId } from './data/items';
import { RELIC_IDS, RELICS, type RelicId } from './data/relics';
import { SHOP_EQUIPMENT_POOLS, SHOP_POTIONS } from './data/shop';
import type { CoreEvent } from './events';
import { RELIC_SLOTS, type HeroState } from './hero';
import { receiveItem, takeFromBag } from './items/Inventory';
import { isVocationItem, type ItemDef, type Vocation } from './items/Item';
import type { Rng } from './rng';
import type { RunState } from './run';
import { revealStairsIfWatcher } from './fog';

/**
 * Mercador (Marco 4). Estoque do andar: 3 equipamentos e 1 relíquia,
 * sorteados ao gerar o andar; comprou, acabou. Poções sempre à venda.
 * Comprar e vender não gastam turno (a loja é um prompt, como as cartas).
 */
export interface MerchantState {
  stock: ItemId[];
  relic: RelicId | null;
}

export type ShopOffer =
  | { readonly kind: 'item'; readonly itemId: ItemId; readonly price: number; readonly stockIndex: number | null }
  | { readonly kind: 'relic'; readonly relicId: RelicId; readonly price: number };

export type ShopFailure = 'no-offer' | 'no-gold' | 'relics-full' | 'no-item';

export function rollMerchant(floor: number, hero: HeroState, rng: Rng): MerchantState {
  const pool = [...(SHOP_EQUIPMENT_POOLS.filter((p) => p.fromFloor <= floor).pop()?.items ?? [])];
  const stock: ItemId[] = [];
  while (stock.length < SHOP.equipmentStock && pool.length > 0) {
    const i = rng.int(0, pool.length - 1);
    stock.push(pool[i] as ItemId);
    pool.splice(i, 1);
  }
  const relics = RELIC_IDS.filter((id) => !hero.relics.includes(id));
  return { stock, relic: relics.length > 0 ? rng.pick(relics) : null };
}

/** Preço de compra: valor × 100%, +10% se é item da vocação. */
export function buyPrice(item: ItemDef, vocation: Vocation): number {
  const bonus = isVocationItem(item, vocation) ? 1 + SHOP.vocationBonus : 1;
  return Math.max(1, Math.round(item.value * SHOP.buyRate * bonus));
}

/** Preço de venda: valor × 30%, +10% se é item da vocação. Todo item vale ≥ 1. */
export function sellPrice(item: ItemDef, vocation: Vocation): number {
  const bonus = isVocationItem(item, vocation) ? 1 + SHOP.vocationBonus : 1;
  return Math.max(1, Math.round(item.value * SHOP.sellRate * bonus));
}

/** O que está à venda agora, na ordem da tela: poções, equipamentos, relíquia. */
export function shopOffers(state: RunState): ShopOffer[] {
  const { hero, merchant } = state;
  if (!merchant) return [];
  const offers: ShopOffer[] = SHOP_POTIONS.map((itemId) => ({
    kind: 'item',
    itemId,
    price: buyPrice(getItem(itemId), hero.vocation),
    stockIndex: null,
  }));
  merchant.stock.forEach((itemId, i) =>
    offers.push({ kind: 'item', itemId, price: buyPrice(getItem(itemId), hero.vocation), stockIndex: i }),
  );
  if (merchant.relic) offers.push({ kind: 'relic', relicId: merchant.relic, price: RELICS[merchant.relic].price });
  return offers;
}

export function buyOffer(state: RunState, index: number, events: CoreEvent[]): true | ShopFailure {
  const offer = shopOffers(state)[index];
  const { hero, merchant } = state;
  if (!offer || !merchant) return 'no-offer';
  if (hero.gold < offer.price) return 'no-gold';
  if (offer.kind === 'relic') {
    if (hero.relics.length >= RELIC_SLOTS) return 'relics-full';
    hero.gold -= offer.price;
    hero.relics.push(offer.relicId);
    merchant.relic = null;
    events.push({ type: 'bought', item: { kind: 'relic', relicId: offer.relicId }, price: offer.price, gold: hero.gold });
    revealStairsIfWatcher(state);
    return true;
  }
  hero.gold -= offer.price;
  if (offer.stockIndex !== null) merchant.stock.splice(offer.stockIndex, 1);
  events.push({ type: 'bought', item: { kind: 'item', itemId: offer.itemId }, price: offer.price, gold: hero.gold });
  // Sem getPlayer: run.ts importa este módulo (evita import circular)
  const player = state.entities.find((e) => e.id === state.playerId);
  if (player) receiveItem(hero, player, offer.itemId, events);
  return true;
}

/** Vende uma unidade da mochila (equipado não: tire primeiro no inventário). */
export function sellItem(state: RunState, itemId: ItemId, events: CoreEvent[]): true | ShopFailure {
  const { hero } = state;
  if (!state.merchant) return 'no-offer';
  if (!takeFromBag(hero, itemId)) return 'no-item';
  const price = sellPrice(getItem(itemId), hero.vocation);
  hero.gold += price;
  events.push({ type: 'sold', itemId, price, gold: hero.gold });
  return true;
}
