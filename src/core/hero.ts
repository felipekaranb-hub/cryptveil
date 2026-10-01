import { KNIGHT_START_MANA, LEVEL_UP_GAIN, XP_PER_LEVEL } from './balance';
import { getItem, type ItemId } from './data/items';
import { ENTITY_TEMPLATES } from './data/entities';
import type { Entity } from './entities/Entity';
import type { CoreEvent } from './events';
import type { Direction } from './grid';
import type { EquipSlot, Vocation } from './items/Item';

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
}

export function createKnightHero(): HeroState {
  const t = ENTITY_TEMPLATES.knight;
  return {
    vocation: 'KNIGHT',
    baseAtk: t.atk,
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
  };
}

/** ATK/DEF efetivos = base + treino + equipamento. */
export function refreshPlayerStats(hero: HeroState, player: Entity): void {
  let atk = hero.baseAtk + hero.trainedAtk;
  let def = hero.baseDef + hero.trainedDef;
  for (const id of Object.values(hero.equipment)) {
    const item = getItem(id);
    if (item.kind === 'equipment') {
      atk += item.atk;
      def += item.def;
    }
  }
  player.atk = atk;
  player.def = def;
}

export function xpToNextLevel(level: number): number {
  return XP_PER_LEVEL * level;
}

/** Soma XP e sobe quantos níveis couberem (+10 HP max e +10 Mana max cada). */
export function gainXp(hero: HeroState, player: Entity, xp: number, events: CoreEvent[]): void {
  hero.xp += xp;
  while (hero.xp >= xpToNextLevel(hero.level)) {
    hero.xp -= xpToNextLevel(hero.level);
    hero.level += 1;
    player.maxHp += LEVEL_UP_GAIN.maxHp;
    player.hp += LEVEL_UP_GAIN.maxHp;
    hero.maxMana += LEVEL_UP_GAIN.maxMana;
    hero.mana += LEVEL_UP_GAIN.maxMana;
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
