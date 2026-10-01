import type { Direction } from './grid';

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
    case 'confirm':
      return 'confirm';
    case 'cancel':
      return 'cancel';
  }
}
