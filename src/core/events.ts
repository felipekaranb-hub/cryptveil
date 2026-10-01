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
  | { readonly type: 'victory' }
  | { readonly type: 'defeat' };
