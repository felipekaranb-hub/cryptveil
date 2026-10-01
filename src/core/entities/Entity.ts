import type { LootTableId } from '../data/lootTables';
import type { Point } from '../grid';

export type EntityKind = 'player' | 'enemy';

/**
 * Ids das estratégias de IA (registro em core/ai). String pra serializar.
 * chase: persegue e bate encostado. skirmisher: igual, mas arremessa de
 * longe quando dá (Goblin, Orc, Orc Warlord — Marco 4).
 */
export type AiId = 'chase' | 'skirmisher';

/**
 * Ataque à distância de monstro (Marco 4): em linha reta, sem parede nem
 * ninguém no meio, mais fraco que o golpe corpo a corpo e com recarga — nos
 * outros turnos o monstro continua avançando (decisão do Felipe: ganha
 * turno, mas não vira kiting que deixe classe ranged forte demais depois).
 */
export interface RangedAttack {
  readonly range: number;
  readonly multiplier: number;
  /** Turnos do monstro entre um arremesso e outro. */
  readonly cooldown: number;
  /** O que ele arremessa, pro LOG ("uma pedra"). */
  readonly projectile: string;
}

/** Invocação do boss: 1 a cada `every` turnos, no máximo `max` vivos. */
export interface SummonAbility {
  readonly every: number;
  readonly max: number;
}

/** Abaixo de `below` do HP max, dano × multiplier. */
export interface EnrageAbility {
  readonly below: number;
  readonly multiplier: number;
}

/** O que o player ganha ao matar (gold sorteado entre min e max, todo kill ≥ 1). */
export interface Reward {
  readonly xp: number;
  readonly goldMin: number;
  readonly goldMax: number;
}

/**
 * Entidade como DADO puro. Sprite, barra de HP e animação moram na view.
 * Tudo aqui vai pro save sem conversão.
 */
export interface Entity {
  readonly id: string;
  readonly kind: EntityKind;
  readonly name: string;
  /** Letra do quadrado provisório (até os sprites do Marco 6). */
  readonly glyph: string;
  pos: Point;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  readonly ai?: AiId;
  readonly reward?: Reward;
  readonly loot?: LootTableId;
  /** Sala onde nasceu. A sala só conta como explorada quando os dela morrem. */
  homeRoom?: number;
  readonly ranged?: RangedAttack;
  readonly summon?: SummonAbility;
  readonly enrage?: EnrageAbility;
  /** Boss da região: a escada do andar só aparece quando ele morre. */
  readonly boss?: boolean;
  /** Turnos até poder arremessar de novo (0/ausente = pronto). */
  rangedCooldown?: number;
  /** Turnos até a próxima invocação. */
  summonTimer?: number;
  enraged?: boolean;
  /** Invocado pelo boss: kill rende só metade do XP (sem gold, loot, mana ou cura). */
  summoned?: boolean;
  /** Já levou golpe do player (relíquia Totem de Guerra). */
  struck?: boolean;
}

/** Modelo pra criar entidades (ver core/data). */
export interface EntityTemplate {
  readonly kind: EntityKind;
  readonly name: string;
  readonly glyph: string;
  readonly maxHp: number;
  readonly atk: number;
  readonly def: number;
  readonly ai?: AiId;
  readonly reward?: Reward;
  readonly loot?: LootTableId;
  readonly ranged?: RangedAttack;
  readonly summon?: SummonAbility;
  readonly enrage?: EnrageAbility;
  readonly boss?: boolean;
}

export function createEntity(id: string, template: EntityTemplate, pos: Point): Entity {
  return {
    id,
    kind: template.kind,
    name: template.name,
    glyph: template.glyph,
    pos: { ...pos },
    hp: template.maxHp,
    maxHp: template.maxHp,
    atk: template.atk,
    def: template.def,
    ...(template.ai ? { ai: template.ai } : {}),
    ...(template.reward ? { reward: { ...template.reward } } : {}),
    ...(template.loot ? { loot: template.loot } : {}),
    ...(template.ranged ? { ranged: { ...template.ranged } } : {}),
    ...(template.summon ? { summon: { ...template.summon }, summonTimer: template.summon.every } : {}),
    ...(template.enrage ? { enrage: { ...template.enrage } } : {}),
    ...(template.boss ? { boss: true } : {}),
  };
}

export function isAlive(e: Entity): boolean {
  return e.hp > 0;
}
