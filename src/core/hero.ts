import { KNIGHT_START_MANA, LEVEL_UP_GAIN, XP_CURVE } from './balance';
import { CARDS, type CardEffect, type CardId } from './data/cards';
import { getItem, type ItemId } from './data/items';
import { RELICS, type RelicEffect, type RelicId } from './data/relics';
import { ENTITY_TEMPLATES } from './data/entities';
import { STARTING_SKILL, type SkillId } from './data/skills';
import type { Entity } from './entities/Entity';
import type { CoreEvent } from './events';
import type { Direction } from './grid';
import type { EquipSlot, Vocation } from './items/Item';
import { NO_BONUSES, type RunBonuses } from './meta/metaProgress';

/**
 * O que é só do player e não faz sentido num monstro: mana, XP, gold,
 * equipamento, inventário e o progresso da Training Room. JSON puro.
 * O ATK/DEF efetivos ficam na Entity do player (o combate só olha lá) e são
 * recalculados por refreshPlayerStats sempre que algo daqui muda.
 */
export interface HeroState {
  readonly vocation: Vocation;
  /** ATK/DEF sem equipamento nem treino. */
  readonly baseAtk: number;
  readonly baseDef: number;
  trainedAtk: number;
  trainedDef: number;
  mana: number;
  maxMana: number;
  level: number;
  /** XP acumulado dentro do nível atual. */
  xp: number;
  gold: number;
  /** Última direção em que andou/atacou: alvo preferido das skills. */
  facing: Direction;
  equipment: Partial<Record<EquipSlot, ItemId>>;
  /** Inventário (não equipado): poções, itens piores, itens de outra vocação. */
  bag: ItemId[];
  /** Salas exploradas na run inteira (entrou e matou os monstros dela). */
  roomsExplored: number;
  /** Training Rooms ganhas que ainda vão aparecer nos próximos andares. */
  trainingPending: number;
  /** Skills liberadas e o nível de cada uma (1–3). */
  skills: Partial<Record<SkillId, number>>;
  /** Cartas de stat/passiva já escolhidas e quantas vezes (empilham). */
  cards: Partial<Record<CardId, number>>;
  /** Level ups que ainda não escolheram carta (subiu vários níveis de uma vez). */
  pendingCardPicks: number;
  /** Relíquias (Marco 4), até RELIC_SLOTS. Compradas no mercador. */
  relics: RelicId[];
  /** Meta (Marco 5, Tome "Saber" 3): XP extra por kill (0,15 = +15%). */
  xpBonusPct: number;
  /** Meta (Tome "Saber" 1): próximas escolhas de carta com +1 opção. */
  bonusOfferCards: number;
  /** Meta (Tome "Releitura"): rerrolagens da escolha de carta que sobram na run. */
  rerolls: number;
}

/** Slots de relíquia (§2.8). */
export const RELIC_SLOTS = 3;

/** Efeito da relíquia do tipo pedido, se o herói tem uma. */
export function relicEffect<T extends RelicEffect['type']>(
  hero: HeroState,
  type: T,
): Extract<RelicEffect, { type: T }> | undefined {
  for (const id of hero.relics) {
    const effect: RelicEffect = RELICS[id].effect;
    if (effect.type === type) return effect as Extract<RelicEffect, { type: T }>;
  }
  return undefined;
}

/** Herói novo. `bonuses` = upgrades do Sanctum (Marco 5); sem meta, nenhum. */
export function createKnightHero(bonuses: RunBonuses = NO_BONUSES): HeroState {
  const t = ENTITY_TEMPLATES.knight;
  return {
    vocation: 'KNIGHT',
    baseAtk: t.atk + bonuses.atk,
    baseDef: t.def,
    trainedAtk: 0,
    trainedDef: 0,
    mana: KNIGHT_START_MANA,
    maxMana: KNIGHT_START_MANA,
    level: 1,
    xp: 0,
    gold: 0,
    facing: 'E',
    equipment: { weapon: 'sword' },
    bag: [],
    roomsExplored: 0,
    trainingPending: 0,
    skills: { [STARTING_SKILL]: 1 },
    cards: {},
    pendingCardPicks: 0,
    relics: [],
    xpBonusPct: bonuses.xpPct,
    bonusOfferCards: bonuses.bonusOfferCards,
    rerolls: bonuses.rerolls,
  };
}

/** XP de um kill com o bônus do Tome (arredondado). */
export function withXpBonus(hero: HeroState, xp: number): number {
  return Math.round(xp * (1 + hero.xpBonusPct));
}

/**
 * Soma de um efeito de carta considerando as pilhas. Ex.: 2× Golpe Crítico
 * → cardTotal(hero, 'critical', e => e.chance) = 0,30.
 */
export function cardTotal<T extends CardEffect['type']>(
  hero: HeroState,
  type: T,
  value: (effect: Extract<CardEffect, { type: T }>) => number,
): number {
  let total = 0;
  for (const [id, stacks] of Object.entries(hero.cards) as [CardId, number][]) {
    const card = CARDS[id];
    if (card.kind === 'boon' && card.effect.type === type) {
      total += value(card.effect as Extract<CardEffect, { type: T }>) * stacks;
    }
  }
  return total;
}

/** ATK/DEF efetivos = (base + treino + equipamento) × cartas de ATK%, + cartas de DEF. */
export function refreshPlayerStats(hero: HeroState, player: Entity): void {
  let atk = hero.baseAtk + hero.trainedAtk;
  let def = hero.baseDef + hero.trainedDef + cardTotal(hero, 'def', (e) => e.amount);
  for (const id of Object.values(hero.equipment)) {
    const item = getItem(id);
    if (item.kind === 'equipment') {
      atk += item.atk;
      def += item.def;
    }
  }
  player.atk = Math.round(atk * (1 + cardTotal(hero, 'atk-pct', (e) => e.pct)));
  player.def = def;
}

/** refreshPlayerStats + evento 'stats-changed' se ATK ou DEF mudaram. */
export function updatePlayerStats(hero: HeroState, player: Entity, events: CoreEvent[]): void {
  const atk = player.atk;
  const def = player.def;
  refreshPlayerStats(hero, player);
  if (player.atk !== atk || player.def !== def) {
    events.push({ type: 'stats-changed', atk: { from: atk, to: player.atk }, def: { from: def, to: player.def } });
  }
}

export function xpToNextLevel(level: number): number {
  return XP_CURVE.base + XP_CURVE.step * (level - 1);
}

/**
 * Soma XP e sobe quantos níveis couberem: +10 HP max e +10 Mana max cada,
 * e uma escolha de carta pendente (o TurnManager abre o prompt).
 */
export function gainXp(hero: HeroState, player: Entity, xp: number, events: CoreEvent[]): void {
  hero.xp += xp;
  while (hero.xp >= xpToNextLevel(hero.level)) {
    hero.xp -= xpToNextLevel(hero.level);
    hero.level += 1;
    player.maxHp += LEVEL_UP_GAIN.maxHp;
    player.hp += LEVEL_UP_GAIN.maxHp;
    hero.maxMana += LEVEL_UP_GAIN.maxMana;
    hero.mana += LEVEL_UP_GAIN.maxMana;
    hero.pendingCardPicks += 1;
    events.push({ type: 'leveled-up', level: hero.level });
  }
}

/** Cura sem passar do máximo. Devolve quanto curou de fato. */
export function healEntity(e: Entity, amount: number): number {
  const before = e.hp;
  e.hp = Math.min(e.maxHp, e.hp + amount);
  return e.hp - before;
}

export function countInBag(hero: HeroState, id: ItemId): number {
  return hero.bag.filter((b) => b === id).length;
}
