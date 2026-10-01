import type { LootTableId } from '../data/lootTables';
import type { Point } from '../grid';

export type EntityKind = 'player' | 'enemy';

/** Ids das estratégias de IA (registro em core/ai). String pra serializar. */
export type AiId = 'chase';

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
  };
}

export function isAlive(e: Entity): boolean {
  return e.hp > 0;
}
