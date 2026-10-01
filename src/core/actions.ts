import type { ItemId } from './data/items';
import type { Direction } from './grid';
import type { EquipSlot } from './items/Item';

/**
 * Intenções do jogador. É isso que o core recebe — nunca tecla, botão ou toque.
 * Teclado, controle (fliperama) e um futuro toque na tela só traduzem
 * entrada física em Action. O core não sabe de onde veio.
 */
export type SkillSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Action =
  | { readonly type: 'move'; readonly dir: Direction }
  | { readonly type: 'wait' }
  | { readonly type: 'skill'; readonly slot: SkillSlot }
  | { readonly type: 'inventory' }
  /** Escolha num prompt do core (Training Room: 0 = +ATK, 1 = +DEF). */
  | { readonly type: 'choose'; readonly index: number }
  /** Inventário (Marco 3): vestir item da mochila, tirar do slot, usar poção. Gastam turno. */
  | { readonly type: 'equip'; readonly itemId: ItemId }
  | { readonly type: 'unequip'; readonly slot: EquipSlot }
  | { readonly type: 'use-item'; readonly itemId: ItemId }
  /** Loja (Marco 4): comprar a oferta N da lista do mercador; vender uma unidade da mochila. Não gastam turno. */
  | { readonly type: 'buy'; readonly index: number }
  | { readonly type: 'sell'; readonly itemId: ItemId }
  /** Trocar de página/aba (Q/E, LB/RB). Só a view usa; o core ignora. */
  | { readonly type: 'page'; readonly delta: -1 | 1 }
  | { readonly type: 'confirm' }
  | { readonly type: 'cancel' };

export function describeAction(a: Action): string {
  switch (a.type) {
    case 'move':
      return `move ${a.dir}`;
    case 'wait':
      return 'wait';
    case 'skill':
      return `skill ${a.slot}`;
    case 'inventory':
      return 'inventory';
    case 'choose':
      return `choose ${a.index}`;
    case 'equip':
      return `equip ${a.itemId}`;
    case 'unequip':
      return `unequip ${a.slot}`;
    case 'use-item':
      return `use ${a.itemId}`;
    case 'buy':
      return `buy ${a.index}`;
    case 'sell':
      return `sell ${a.itemId}`;
    case 'page':
      return `page ${a.delta}`;
    case 'confirm':
      return 'confirm';
    case 'cancel':
      return 'cancel';
  }
}
