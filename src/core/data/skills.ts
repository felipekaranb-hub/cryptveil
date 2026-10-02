import type { SkillSlot } from '../actions';
import type { ItemId } from './items';

/**
 * Skills do Knight. Limite: mana e, desde o Marco 6b, recarga (SKILL_COOLDOWNS
 * em balance.ts). Todas usam o ATK (§2.6).
 *
 * Marco 2d: o Knight começa só com o Brutal Strike. As outras saem como
 * CARTA no level up; tirar de novo a carta de uma skill que já tem sobe o
 * nível dela (até o 3). `levels[0]` é o nível 1. Números provisórios.
 */
interface LevelBase {
  readonly manaCost: number;
  /** Resumo curto pra carta ("×1,6", "custa 3"…). */
  readonly summary: string;
}

export type SkillDef =
  /** 1 alvo adjacente (prefere o da direção que o Knight está olhando). */
  | { readonly kind: 'strike'; readonly name: string; readonly levels: readonly (LevelBase & { readonly multiplier: number })[] }
  /** Os 4 adjacentes (§2.10). */
  | { readonly kind: 'area'; readonly name: string; readonly levels: readonly (LevelBase & { readonly multiplier: number })[] }
  /** Linha reta sem atravessar parede; `pierce` acerta todos da linha, senão só o primeiro. */
  | {
      readonly kind: 'ranged';
      readonly name: string;
      readonly levels: readonly (LevelBase & {
        readonly multiplier: number;
        readonly range: number;
        readonly pierce: boolean;
      })[];
    }
  | { readonly kind: 'heal'; readonly name: string; readonly levels: readonly (LevelBase & { readonly healPct: number })[] };

export const SKILLS = {
  brutalStrike: {
    kind: 'strike',
    name: 'Brutal Strike',
    levels: [
      { manaCost: 5, multiplier: 2, summary: '1 alvo, ×2' },
      { manaCost: 3, multiplier: 2, summary: 'passa a custar 3' },
      { manaCost: 3, multiplier: 2.5, summary: '×2,5' },
    ],
  },
  berserk: {
    kind: 'area',
    name: 'Berserk',
    levels: [
      { manaCost: 10, multiplier: 1.25, summary: '4 adjacentes, ×1,25' },
      { manaCost: 10, multiplier: 1.6, summary: '×1,6' },
      { manaCost: 8, multiplier: 1.6, summary: 'passa a custar 8' },
    ],
  },
  whirlwindThrow: {
    kind: 'ranged',
    name: 'Whirlwind Throw',
    levels: [
      { manaCost: 8, multiplier: 1.5, range: 3, pierce: false, summary: 'linha até 3, ×1,5' },
      { manaCost: 8, multiplier: 1.5, range: 3, pierce: true, summary: 'atravessa: todos da linha' },
      { manaCost: 8, multiplier: 1.5, range: 5, pierce: true, summary: 'alcance 5' },
    ],
  },
  woundCleansing: {
    kind: 'heal',
    name: 'Wound Cleansing',
    levels: [
      { manaCost: 10, healPct: 0.25, summary: 'cura 25% do HP' },
      { manaCost: 10, healPct: 0.4, summary: 'cura 40%' },
      { manaCost: 6, healPct: 0.4, summary: 'passa a custar 6' },
    ],
  },
} as const satisfies Record<string, SkillDef>;

export type SkillId = keyof typeof SKILLS;

/** Skill com que o Knight começa a run. */
export const STARTING_SKILL: SkillId = 'brutalStrike';

/** Skill no nível atual, já sem a lista de níveis (o que o combate usa). */
export type ResolvedSkill =
  | { readonly kind: 'strike' | 'area'; readonly manaCost: number; readonly multiplier: number }
  | {
      readonly kind: 'ranged';
      readonly manaCost: number;
      readonly multiplier: number;
      readonly range: number;
      readonly pierce: boolean;
    }
  | { readonly kind: 'heal'; readonly manaCost: number; readonly healPct: number };

function levelIndex(def: SkillDef, level: number): number {
  return Math.min(def.levels.length, Math.max(1, level)) - 1;
}

export function resolveSkill(id: SkillId, level: number): ResolvedSkill {
  const def: SkillDef = SKILLS[id];
  switch (def.kind) {
    case 'strike':
    case 'area': {
      const l = def.levels[levelIndex(def, level)]!;
      return { kind: def.kind, manaCost: l.manaCost, multiplier: l.multiplier };
    }
    case 'ranged': {
      const l = def.levels[levelIndex(def, level)]!;
      return { kind: 'ranged', manaCost: l.manaCost, multiplier: l.multiplier, range: l.range, pierce: l.pierce };
    }
    case 'heal': {
      const l = def.levels[levelIndex(def, level)]!;
      return { kind: 'heal', manaCost: l.manaCost, healPct: l.healPct };
    }
  }
}

/** Texto curto do nível (pra carta e hotbar). */
export function skillSummary(id: SkillId, level: number): string {
  const def: SkillDef = SKILLS[id];
  return def.levels[levelIndex(def, level)]!.summary;
}

export function maxSkillLevel(id: SkillId): number {
  return SKILLS[id].levels.length;
}

export type HotbarEntry =
  | { readonly type: 'skill'; readonly id: SkillId }
  | { readonly type: 'item'; readonly id: ItemId };

/**
 * Hotbar fixa do Knight (teclas 1–8): cada skill tem sempre o mesmo slot,
 * mesmo antes de liberada (memória muscular). O Marco 3 transforma em
 * hotbar de verdade, com UI e mapeamento no controle.
 */
export const KNIGHT_HOTBAR: Readonly<Partial<Record<SkillSlot, HotbarEntry>>> = {
  1: { type: 'skill', id: 'brutalStrike' },
  2: { type: 'skill', id: 'berserk' },
  3: { type: 'skill', id: 'whirlwindThrow' },
  4: { type: 'skill', id: 'woundCleansing' },
  5: { type: 'item', id: 'hpPotion' },
  6: { type: 'item', id: 'manaPotion' },
};
