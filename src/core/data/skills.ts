import type { SkillSlot } from '../actions';
import type { ItemId } from './items';

/**
 * Skills (handoff §7, decidido no Marco 2). Sem cooldown: o limite é a mana.
 * Todas usam o ATK do Knight (§2.6). Números provisórios.
 */
export type SkillDef =
  /** 1 alvo adjacente (prefere o da direção que o Knight está olhando). */
  | { readonly kind: 'strike'; readonly name: string; readonly manaCost: number; readonly multiplier: number }
  /** Os 4 adjacentes (§2.10). */
  | { readonly kind: 'area'; readonly name: string; readonly manaCost: number; readonly multiplier: number }
  /** 1 alvo em linha reta, sem parede no caminho. */
  | {
      readonly kind: 'ranged';
      readonly name: string;
      readonly manaCost: number;
      readonly multiplier: number;
      readonly range: number;
    }
  | { readonly kind: 'heal'; readonly name: string; readonly manaCost: number; readonly healPct: number };

export const SKILLS = {
  // Marco 2c: toda skill de dano tem que valer mais que um golpe básico
  brutalStrike: { kind: 'strike', name: 'Brutal Strike', manaCost: 5, multiplier: 2 },
  berserk: { kind: 'area', name: 'Berserk', manaCost: 10, multiplier: 1.25 },
  whirlwindThrow: { kind: 'ranged', name: 'Whirlwind Throw', manaCost: 8, multiplier: 1.5, range: 3 },
  woundCleansing: { kind: 'heal', name: 'Wound Cleansing', manaCost: 10, healPct: 0.25 },
} as const satisfies Record<string, SkillDef>;

export type SkillId = keyof typeof SKILLS;

export type HotbarEntry =
  | { readonly type: 'skill'; readonly id: SkillId }
  | { readonly type: 'item'; readonly id: ItemId };

/**
 * Hotbar fixa do Knight (teclas 1–8). O Marco 3 transforma em hotbar de
 * verdade, com UI e mapeamento no controle.
 */
export const KNIGHT_HOTBAR: Readonly<Partial<Record<SkillSlot, HotbarEntry>>> = {
  1: { type: 'skill', id: 'brutalStrike' },
  2: { type: 'skill', id: 'berserk' },
  3: { type: 'skill', id: 'whirlwindThrow' },
  4: { type: 'skill', id: 'woundCleansing' },
  5: { type: 'item', id: 'hpPotion' },
  6: { type: 'item', id: 'manaPotion' },
};
