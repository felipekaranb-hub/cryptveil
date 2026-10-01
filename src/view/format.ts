import { ROOMS_PER_TRAINING } from '../core/balance';
import { getItem } from '../core/data/items';
import { SKILLS } from '../core/data/skills';
import type { CoreEvent } from '../core/events';
import { getEntity, type RunState } from '../core/run';
import type { TurnResult } from '../core/turn/TurnManager';

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
    case 'descended':
      return event.hasTraining
        ? `Andar ${event.floor}: tem uma Training Room aqui!`
        : `Você desce ao andar ${event.floor}`;
    case 'skill-used':
      return `${name(event.entityId)} usa ${SKILLS[event.skillId].name}`;
    case 'healed':
      return event.source === 'passive' ? `+${event.amount} HP (kill)` : `Recupera ${event.amount} HP`;
    case 'mana-restored':
      return `Recupera ${event.amount} de mana`;
    case 'rewarded':
      return `+${event.xp} XP  +${event.gold} gold`;
    case 'leveled-up':
      return `Subiu para o nível ${event.level}!`;
    case 'looted':
      return event.equipped ? `Equipou ${getItem(event.itemId).name}` : `Pegou ${getItem(event.itemId).name}`;
    case 'room-cleared': {
      if (event.trainingEarned) return 'Sala explorada! Training Room no próximo andar';
      const progress = event.explored % ROOMS_PER_TRAINING;
      return `Sala explorada (${progress}/${ROOMS_PER_TRAINING})`;
    }
    case 'training-offered':
      return 'Training Room: escolha +2 ATK ou +2 DEF';
    case 'trained':
      return `Treinou: +${event.amount} ${event.stat.toUpperCase()}`;
    case 'stats-changed': {
      const parts: string[] = [];
      if (event.atk.from !== event.atk.to) parts.push(`ATK ${event.atk.from} → ${event.atk.to}`);
      if (event.def.from !== event.def.to) parts.push(`DEF ${event.def.from} → ${event.def.to}`);
      return parts.join('  ');
    }
    case 'victory':
      return 'Vitória!';
    case 'defeat':
      return 'Você morreu.';
    case 'moved':
      return null; // andar não polui o log
  }
}

/** Aviso no LOG quando a ação não saiu (skill sem mana etc.). Parede fica quieta. */
export function formatFailure(result: TurnResult): string | null {
  if (result.tookTurn) return null;
  switch (result.reason) {
    case 'no-mana':
      return 'Mana insuficiente';
    case 'no-target':
      return 'Nenhum alvo ao alcance';
    case 'full-hp':
      return 'HP já está cheio';
    case 'full-mana':
      return 'Mana já está cheia';
    case 'no-item':
      return 'Você não tem essa poção';
    default:
      return null;
  }
}
