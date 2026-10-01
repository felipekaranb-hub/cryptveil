import type { CoreEvent } from '../core/events';
import { getEntity, type RunState } from '../core/run';

/**
 * Texto do LOG de combate a partir dos eventos do core.
 * Fica na view porque é apresentação (idioma, tom); o core só diz o que houve.
 */
export function formatEvent(event: CoreEvent, state: RunState): string | null {
  const name = (id: string): string => getEntity(state, id)?.name ?? id;
  switch (event.type) {
    case 'attacked':
      return `${name(event.attackerId)} acerta ${name(event.targetId)}: ${event.damage}`;
    case 'died':
      return `${name(event.entityId)} morreu`;
    case 'waited':
      return `${name(event.entityId)} espera`;
    case 'victory':
      return 'Vitória!';
    case 'defeat':
      return 'Você morreu.';
    case 'moved':
      return null; // andar não polui o log
  }
}
