import type { ItemId } from './data/items';
import type { SkillId } from './data/skills';
import type { Point } from './grid';

/**
 * O que aconteceu num turno, em ordem. O core produz; a view anima e o
 * BattleLog lista. Nenhum evento carrega objeto do Phaser.
 */
export type CoreEvent =
  | { readonly type: 'moved'; readonly entityId: string; readonly from: Point; readonly to: Point }
  | {
      readonly type: 'attacked';
      readonly attackerId: string;
      readonly targetId: string;
      readonly damage: number;
      readonly targetHp: number;
    }
  | { readonly type: 'died'; readonly entityId: string }
  | { readonly type: 'waited'; readonly entityId: string }
  /** Player pisou na escada: o RunState já está no andar novo (mapa e monstros trocados). */
  | { readonly type: 'descended'; readonly floor: number; readonly hasTraining: boolean }
  | { readonly type: 'skill-used'; readonly entityId: string; readonly skillId: SkillId }
  | {
      readonly type: 'healed';
      readonly entityId: string;
      readonly amount: number;
      readonly hp: number;
      readonly source: 'skill' | 'potion' | 'passive';
    }
  | { readonly type: 'mana-restored'; readonly amount: number; readonly mana: number }
  | { readonly type: 'rewarded'; readonly xp: number; readonly gold: number }
  | { readonly type: 'leveled-up'; readonly level: number }
  /** Item foi pro inventário; `equipped` = vestiu na hora (era melhor que o do slot). */
  | { readonly type: 'looted'; readonly itemId: ItemId; readonly equipped: boolean }
  | { readonly type: 'room-cleared'; readonly explored: number; readonly trainingEarned: boolean }
  | { readonly type: 'training-offered' }
  | { readonly type: 'trained'; readonly stat: 'atk' | 'def'; readonly amount: number }
  /** ATK/DEF efetivos do player mudaram (equipou, treinou): a view mostra "ATK 10 → 16". */
  | {
      readonly type: 'stats-changed';
      readonly atk: { readonly from: number; readonly to: number };
      readonly def: { readonly from: number; readonly to: number };
    }
  | { readonly type: 'victory' }
  | { readonly type: 'defeat' };
