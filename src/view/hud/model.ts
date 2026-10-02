import type { Action, SkillSlot } from '../../core/actions';
import { CARDS, type CardId } from '../../core/data/cards';
import { getItem, type ItemId } from '../../core/data/items';
import { KNIGHT_HOTBAR, resolveSkill, SKILLS, STARTING_SKILL, skillSummary, type SkillId } from '../../core/data/skills';
import { RELICS } from '../../core/data/relics';
import { getTile, TileType } from '../../core/dungeon/DungeonMap';
import { sellPrice, shopOffers } from '../../core/shop';
import { countInBag, RELIC_SLOTS, xpToNextLevel, type HeroState } from '../../core/hero';
import { canEquip, equipmentScore, type EquipmentDef, type EquipSlot } from '../../core/items/Item';
import { getPlayer, type RunState } from '../../core/run';
import { roman } from '../format';

/**
 * Modelos do HUD: o RunState vira dado pronto pra desenhar. A GameScene
 * monta e manda por evento; a UIScene só desenha (nunca lê o RunState).
 */

/** Ordem e nome dos slots do paper doll (handoff §2.8). */
export const GEAR_SLOTS: readonly { readonly slot: EquipSlot; readonly label: string }[] = [
  { slot: 'helmet', label: 'Elmo' },
  { slot: 'amulet', label: 'Amuleto' },
  { slot: 'armor', label: 'Armadura' },
  { slot: 'ring', label: 'Anel' },
  { slot: 'weapon', label: 'Arma' },
  { slot: 'shield', label: 'Escudo' },
  { slot: 'legs', label: 'Calça' },
  { slot: 'boots', label: 'Botas' },
];


export interface GearSlotView {
  readonly slot: EquipSlot;
  readonly label: string;
  /** Nome do item, ou null se vazio. */
  readonly item: string | null;
  /** Id do item (a view acha o ícone), ou null se vazio. */
  readonly itemId: ItemId | null;
}

export type HotbarState = 'ready' | 'locked' | 'unusable' | 'empty';

export interface HotbarSlotView {
  readonly slot: SkillSlot;
  readonly name: string;
  /** "5 mana", "×2", "—". */
  readonly detail: string;
  readonly state: HotbarState;
}

export interface HudSnapshot {
  readonly hp: number;
  readonly maxHp: number;
  readonly mana: number;
  readonly maxMana: number;
  readonly atk: number;
  readonly def: number;
  readonly level: number;
  readonly xp: number;
  readonly xpNext: number;
  readonly gold: number;
  readonly turn: number;
  readonly floor: number;
  readonly gear: readonly GearSlotView[];
  readonly relics: readonly (string | null)[];
  readonly hotbar: readonly HotbarSlotView[];
  /** Cartas escolhidas na run (level up). */
  readonly deckSize: number;
}

export function buildHud(state: RunState): HudSnapshot {
  const p = getPlayer(state);
  const { hero } = state;
  return {
    hp: p.hp,
    maxHp: p.maxHp,
    mana: hero.mana,
    maxMana: hero.maxMana,
    atk: p.atk,
    def: p.def,
    level: hero.level,
    xp: hero.xp,
    xpNext: xpToNextLevel(hero.level),
    gold: hero.gold,
    turn: state.turn,
    floor: state.floor,
    gear: GEAR_SLOTS.map(({ slot, label }) => {
      const id = hero.equipment[slot];
      return { slot, label, item: id ? getItem(id).name : null, itemId: id ?? null };
    }),
    relics: Array.from({ length: RELIC_SLOTS }, (_, i) => {
      const id = hero.relics[i];
      return id ? RELICS[id].name : null;
    }),
    hotbar: buildHotbar(state),
    deckSize: deckSize(hero),
  };
}

const SLOTS: readonly SkillSlot[] = [1, 2, 3, 4, 5, 6, 7, 8];

function buildHotbar(state: RunState): HotbarSlotView[] {
  const { hero } = state;
  const p = getPlayer(state);
  return SLOTS.map((slot): HotbarSlotView => {
    const entry = KNIGHT_HOTBAR[slot];
    if (!entry) return { slot, name: '', detail: '', state: 'empty' };
    if (entry.type === 'skill') {
      const level = hero.skills[entry.id];
      if (!level) return { slot, name: SKILLS[entry.id].name, detail: '—', state: 'locked' };
      const skill = resolveSkill(entry.id, level);
      const lv = level > 1 ? ` ${roman(level)}` : '';
      return {
        slot,
        name: `${SKILLS[entry.id].name}${lv}`,
        detail: `${skill.manaCost} mana`,
        state: hero.mana >= skill.manaCost ? 'ready' : 'unusable',
      };
    }
    const count = countInBag(hero, entry.id);
    const full = entry.id === 'hpPotion' ? p.hp >= p.maxHp : hero.mana >= hero.maxMana;
    return {
      slot,
      name: entry.id === 'hpPotion' ? 'Poção HP' : 'Poção Mana',
      detail: `×${count}`,
      state: count > 0 && !full ? 'ready' : 'unusable',
    };
  });
}

/** Cartas escolhidas: níveis de skill ganhos em carta + pilhas das passivas. */
function deckSize(hero: HeroState): number {
  let n = 0;
  for (const [id, level] of Object.entries(hero.skills) as [SkillId, number][]) {
    n += id === STARTING_SKILL ? level - 1 : level;
  }
  for (const stacks of Object.values(hero.cards)) n += stacks ?? 0;
  return n;
}

// ------------------------------------------------------------------ minimapa

/** Célula do minimapa. 0 = não explorado. */
export const MiniCell = { UNKNOWN: 0, FLOOR: 1, WALL: 2, STAIRS: 3, TRAINING: 4, MERCHANT: 5 } as const;
export type MiniCell = (typeof MiniCell)[keyof typeof MiniCell];

export interface MinimapView {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly MiniCell[];
  readonly player: { readonly x: number; readonly y: number };
  /** Monstros que o Knight vê agora. */
  readonly enemies: readonly { readonly x: number; readonly y: number }[];
}

export function buildMinimap(state: RunState, visible: ReadonlySet<number>): MinimapView {
  const { map } = state;
  const cells = new Array<MiniCell>(map.width * map.height).fill(MiniCell.UNKNOWN);
  for (const key of state.explored) {
    const tile = getTile(map, { x: key % map.width, y: Math.floor(key / map.width) });
    cells[key] =
      tile === TileType.WALL
        ? MiniCell.WALL
        : tile === TileType.STAIRS
          ? MiniCell.STAIRS
          : tile === TileType.TRAINING
            ? MiniCell.TRAINING
            : tile === TileType.MERCHANT
              ? MiniCell.MERCHANT
              : MiniCell.FLOOR;
  }
  const enemies = state.entities
    .filter((e) => e.kind === 'enemy' && e.hp > 0 && visible.has(e.pos.y * map.width + e.pos.x))
    .map((e) => ({ ...e.pos }));
  return { width: map.width, height: map.height, cells, player: { ...getPlayer(state).pos }, enemies };
}

// ---------------------------------------------------------------- inventário

export const INVENTORY_TABS = ['Mochila', 'Pra vender', 'Deck'] as const;

export interface InventoryRow {
  readonly text: string;
  /** Coluna da direita (stats, contagem, nível). */
  readonly detail: string;
  /** Explicação da linha selecionada (rodapé). */
  readonly info: string;
  /** Verbo do botão confirmar ("equipar", "usar"…), ou null se não faz nada. */
  readonly verb: string | null;
  /** O que o confirmar manda pro core. */
  readonly action: Action | null;
  /** Título de seção: não dá pra selecionar. */
  readonly header?: boolean;
  /** Destaque: melhor que o equipado (↑) ou pior (↓). */
  readonly tone?: 'better' | 'worse';
  /** Loja: pilha de mais de 1 unidade — o Enter pergunta se vende todas. */
  readonly stack?: { readonly itemId: ItemId; readonly name: string; readonly count: number; readonly unitPrice: number };
}

export interface InventoryView {
  readonly tab: number;
  readonly tabs: readonly string[];
  readonly rows: readonly InventoryRow[];
  readonly selected: number;
  /** Texto à direita do rodapé (loja: gold do player). */
  readonly status?: string;
  /** Pergunta aberta por cima da lista (loja: vender todos ou 1). */
  readonly confirm?: { readonly title: string; readonly options: readonly string[]; readonly selected: number };
}

export function buildInventoryRows(state: RunState, tab: number): InventoryRow[] {
  if (tab === 0) return bagRows(state.hero);
  if (tab === 1) return sellRows(state.hero);
  return deckRows(state.hero);
}

const header = (text: string): InventoryRow => ({ text, detail: '', info: '', verb: null, action: null, header: true });

function itemStats(item: EquipmentDef): string {
  const parts: string[] = [];
  if (item.atk) parts.push(`ATK +${item.atk}`);
  if (item.def) parts.push(`DEF +${item.def}`);
  return parts.join('  ') || '—';
}

/** Itens da mochila agrupados por id, na ordem em que chegaram. */
function grouped(bag: readonly ItemId[]): [ItemId, number][] {
  const counts = new Map<ItemId, number>();
  for (const id of bag) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts];
}

function bagRows(hero: HeroState): InventoryRow[] {
  const rows: InventoryRow[] = [header('EQUIPADO')];
  for (const { slot, label } of GEAR_SLOTS) {
    const id = hero.equipment[slot];
    if (!id) continue;
    const item = getItem(id);
    if (item.kind !== 'equipment') continue;
    rows.push({
      text: `${label}: ${item.name}`,
      detail: itemStats(item),
      info: 'Guarda na mochila (gasta o turno)',
      verb: 'tirar',
      action: { type: 'unequip', slot },
    });
  }

  rows.push(header('MOCHILA'));
  const usable = grouped(hero.bag).filter(([id]) => {
    const item = getItem(id);
    return item.kind === 'potion' || canEquip(item, hero.vocation);
  });
  if (usable.length === 0) rows.push(header('  (vazia)'));
  for (const [id, count] of usable) {
    const item = getItem(id);
    const qty = count > 1 ? ` ×${count}` : '';
    if (item.kind === 'potion') {
      const what = item.effect.type === 'heal' ? 'HP' : 'mana';
      rows.push({
        text: `${item.name}${qty}`,
        detail: `+${Math.round(item.effect.pct * 100)}% ${what}`,
        info: 'Usar gasta o turno',
        verb: 'usar',
        action: { type: 'use-item', itemId: id },
      });
      continue;
    }
    if (item.kind !== 'equipment') continue;
    const currentId = hero.equipment[item.slot];
    const current = currentId ? getItem(currentId) : undefined;
    const currentScore = current?.kind === 'equipment' ? equipmentScore(current) : 0;
    const delta = equipmentScore(item) - currentScore;
    const slotLabel = GEAR_SLOTS.find((g) => g.slot === item.slot)?.label ?? item.slot;
    rows.push({
      text: `${item.name}${qty}`,
      detail: itemStats(item),
      info: `${slotLabel}: troca ${current ? current.name : 'slot vazio'} (gasta o turno)`,
      verb: 'equipar',
      action: { type: 'equip', itemId: id },
      ...(delta > 0 ? { tone: 'better' as const } : delta < 0 ? { tone: 'worse' as const } : {}),
    });
  }
  return rows;
}

/** Fora da vocação (§2.5): só serve pra vender na loja do Marco 4. */
function sellRows(hero: HeroState): InventoryRow[] {
  const rows = grouped(hero.bag)
    .filter(([id]) => {
      const item = getItem(id);
      return item.kind === 'material' || (item.kind === 'equipment' && !canEquip(item, hero.vocation));
    })
    .map(([id, count]): InventoryRow => {
      const item = getItem(id);
      return {
        text: `${item.name}${count > 1 ? ` ×${count}` : ''}`,
        detail: `vende por ${sellPrice(item, hero.vocation)}g`,
        info: item.kind === 'material' ? 'Produto de criatura: venda no mercador' : 'O Knight não usa: venda no mercador',
        verb: null,
        action: null,
      };
    });
  return rows.length > 0 ? rows : [header('Nada aqui: produtos de criatura e itens que o Knight não usa vêm pra cá')];
}

function deckRows(hero: HeroState): InventoryRow[] {
  const rows: InventoryRow[] = [header('SKILLS')];
  for (const [id, level] of Object.entries(hero.skills) as [SkillId, number][]) {
    const lv = level > 1 ? ` ${roman(level)}` : '';
    rows.push({
      text: `${SKILLS[id].name}${lv}`,
      detail: `${resolveSkill(id, level).manaCost} mana`,
      info: `Nível ${level}/${SKILLS[id].levels.length}: ${skillSummary(id, level)}`,
      verb: null,
      action: null,
    });
  }
  rows.push(header('RELÍQUIAS'));
  if (hero.relics.length === 0) rows.push(header('  (nenhuma: o mercador vende)'));
  for (const id of hero.relics) {
    rows.push({ text: RELICS[id].name, detail: '', info: RELICS[id].description, verb: null, action: null });
  }
  rows.push(header('CARTAS'));
  const cards = Object.entries(hero.cards) as [CardId, number][];
  if (cards.length === 0) rows.push(header('  (nenhuma ainda: escolha no level up)'));
  for (const [id, stacks] of cards) {
    const card = CARDS[id];
    if (card.kind !== 'boon') continue;
    rows.push({
      text: card.name,
      detail: card.maxStacks > 1 ? `${stacks}/${card.maxStacks}` : '',
      info: card.description,
      verb: null,
      action: null,
    });
  }
  return rows;
}

// --------------------------------------------------------------------- loja

export const SHOP_TABS = ['Comprar', 'Vender'] as const;

/** Linhas da loja: aba Comprar (ofertas do mercador) ou Vender (tudo da mochila). */
export function buildShopRows(state: RunState, tab: number): InventoryRow[] {
  const { hero } = state;
  if (tab === 0) {
    return shopOffers(state).map((offer, index): InventoryRow => {
      const affordable = hero.gold >= offer.price;
      if (offer.kind === 'relic') {
        const relic = RELICS[offer.relicId];
        return {
          text: `Relíquia: ${relic.name}`,
          detail: `${offer.price}g`,
          info: relic.description,
          verb: affordable ? 'comprar' : null,
          action: { type: 'buy', index },
          ...(affordable ? {} : { tone: 'worse' as const }),
        };
      }
      const item = getItem(offer.itemId);
      const stats = item.kind === 'equipment' ? `  ${itemStats(item)}` : '';
      return {
        text: `${item.name}${offer.stockIndex === null ? '' : ' (1 un.)'}`,
        detail: `${offer.price}g`,
        info:
          item.kind === 'potion'
            ? `Sempre à venda${stats}`
            : `${GEAR_SLOTS.find((g) => item.kind === 'equipment' && g.slot === item.slot)?.label ?? ''}${stats}`,
        verb: affordable ? 'comprar' : null,
        action: { type: 'buy', index },
        ...(affordable ? {} : { tone: 'worse' as const }),
      };
    });
  }
  const rows = grouped(hero.bag).map(([id, count]): InventoryRow => {
    const item = getItem(id);
    const unitPrice = sellPrice(item, hero.vocation);
    const what = item.kind === 'equipment' ? itemStats(item) : item.kind === 'material' ? 'Produto de criatura' : 'Poção';
    return {
      text: `${item.name}${count > 1 ? ` ×${count}` : ''}`,
      detail: count > 1 ? `+${unitPrice}g cada` : `+${unitPrice}g`,
      info: count > 1 ? `${what} · todos: +${unitPrice * count}g` : what,
      verb: 'vender',
      action: { type: 'sell', itemId: id },
      ...(count > 1 ? { stack: { itemId: id, name: item.name, count, unitPrice } } : {}),
    };
  });
  return rows.length > 0 ? rows : [header('Mochila vazia (equipado não vende: tire no inventário)')];
}
