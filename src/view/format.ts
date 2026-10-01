import { TRAINING_BONUS } from '../core/balance';
import { CARDS, type CardId } from '../core/data/cards';
import { getItem } from '../core/data/items';
import { resolveSkill, SKILLS, skillSummary } from '../core/data/skills';
import type { HeroState } from '../core/hero';
import type { CoreEvent } from '../core/events';
import { getEntity, type RunState } from '../core/run';
import type { TurnResult } from '../core/turn/TurnManager';
import type { ChoiceOption } from './events';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const;
export const roman = (n: number): string => ROMAN[n] ?? String(n);

/** Tom da linha do LOG: vira cor na UIScene (LOG_TONE_COLORS). */
export type LogTone = 'normal' | 'muted' | 'danger' | 'good' | 'mana' | 'loot' | 'level';

export interface LogLine {
  readonly text: string;
  readonly tone: LogTone;
}

/**
 * Linha do LOG de combate a partir de um evento do core.
 * Fica na view porque é apresentação (idioma, tom); o core só diz o que houve.
 */
export function formatEvent(event: CoreEvent, state: RunState): LogLine | null {
  const name = (id: string): string => getEntity(state, id)?.name ?? id;
  const line = (text: string, tone: LogTone = 'normal'): LogLine => ({ text, tone });
  switch (event.type) {
    case 'attacked':
      return line(
        `${name(event.attackerId)} acerta ${name(event.targetId)}: ${event.damage}${event.critical ? ' (crítico!)' : ''}`,
        event.targetId === state.playerId ? 'danger' : 'normal',
      );
    case 'countered':
      return line('Contra-ataque!');
    case 'died':
      return event.entityId === state.playerId ? line('Você caiu.', 'danger') : line(`${name(event.entityId)} morreu`, 'good');
    case 'waited':
      return line(`${name(event.entityId)} espera`, 'muted');
    case 'descended':
      return event.hasTraining
        ? line(`Andar ${event.floor}: tem uma Training Room aqui!`, 'level')
        : line(`Você desce ao andar ${event.floor}`, 'level');
    case 'skill-used':
      return line(`${name(event.entityId)} usa ${SKILLS[event.skillId].name}`);
    case 'healed':
      if (event.source === 'passive') return line(`+${event.amount} HP (kill)`, 'good');
      if (event.source === 'vampirism') return line(`+${event.amount} HP (vampirismo)`, 'good');
      return line(`Recupera ${event.amount} HP`, 'good');
    case 'mana-restored':
      return line(`Recupera ${event.amount} de mana`, 'mana');
    case 'rewarded':
      return line(`+${event.xp} XP  +${event.gold} gold`, 'loot');
    case 'leveled-up':
      return line(`Subiu para o nível ${event.level}!`, 'level');
    case 'looted':
      return line(event.equipped ? `Equipou ${getItem(event.itemId).name}` : `Pegou ${getItem(event.itemId).name}`, 'loot');
    case 'equipped':
      return line(`Equipou ${getItem(event.itemId).name}`, 'loot');
    case 'unequipped':
      return line(`Guardou ${getItem(event.itemId).name} na mochila`, 'muted');
    case 'room-cleared':
      // Sem contador: a regra da sala de treino é implícita (decisão do Felipe, Marco 2d)
      return line('Sala explorada', 'muted');
    case 'training-offered':
      return line('Training Room: escolha +2 ATK ou +2 DEF', 'level');
    case 'trained':
      return line(`Treinou: +${event.amount} ${event.stat.toUpperCase()}`, 'level');
    case 'card-offered':
      return line('Subiu de nível: escolha uma carta', 'level');
    case 'card-picked': {
      const card = CARDS[event.cardId];
      if (card.kind === 'skill') {
        const skillName = SKILLS[card.skillId].name;
        return line(event.level === 1 ? `Nova skill: ${skillName}` : `${skillName} ${roman(event.level)}`, 'level');
      }
      return line(card.maxStacks > 1 ? `Carta: ${card.name} (${event.level}/${card.maxStacks})` : `Carta: ${card.name}`, 'level');
    }
    case 'stats-changed': {
      const parts: string[] = [];
      if (event.atk.from !== event.atk.to) parts.push(`ATK ${event.atk.from} → ${event.atk.to}`);
      if (event.def.from !== event.def.to) parts.push(`DEF ${event.def.from} → ${event.def.to}`);
      return line(parts.join('  '), 'level');
    }
    case 'victory':
      return line('Vitória!', 'level');
    case 'defeat':
      return line('Você morreu.', 'danger');
    case 'moved':
      return null; // andar não polui o log
  }
}

/** Aviso no LOG quando a ação não saiu (skill sem mana etc.). Parede fica quieta. */
export function formatFailure(result: TurnResult): string | null {
  if (result.tookTurn) return null;
  switch (result.reason) {
    case 'skill-locked':
      return 'Skill ainda não liberada (vem em carta de level up)';
    case 'no-mana':
      return 'Mana insuficiente';
    case 'no-target':
      return 'Nenhum alvo ao alcance';
    case 'full-hp':
      return 'HP já está cheio';
    case 'full-mana':
      return 'Mana já está cheia';
    case 'no-item':
      return 'Você não tem esse item';
    case 'cannot-equip':
      return 'O Knight não usa esse item';
    case 'empty-slot':
      return 'Não tem nada nesse slot';
    default:
      return null;
  }
}

/** Texto da carta na tela de escolha, no estado ATUAL do herói (antes de escolher). */
export function describeCard(id: CardId, hero: HeroState): ChoiceOption {
  const card = CARDS[id];
  if (card.kind === 'skill') {
    const current = hero.skills[card.skillId] ?? 0;
    const next = current + 1;
    const skill = resolveSkill(card.skillId, next);
    return {
      title: current === 0 ? SKILLS[card.skillId].name : `${SKILLS[card.skillId].name} ${roman(next)}`,
      subtitle: current === 0 ? 'Nova skill' : 'Melhoria de skill',
      description: `${skillSummary(card.skillId, next)}\n\nMana: ${skill.manaCost}`,
      rarity: card.rarity,
    };
  }
  const stacks = hero.cards[id] ?? 0;
  return {
    title: card.name,
    subtitle: stacks > 0 ? `Tem ${stacks}/${card.maxStacks}` : RARITY_LABEL[card.rarity],
    description: card.description,
    rarity: card.rarity,
  };
}

export const RARITY_LABEL = { common: 'Comum', rare: 'Rara', epic: 'Épica' } as const;

export function describeTraining(): ChoiceOption[] {
  return [
    { title: `+${TRAINING_BONUS} ATK`, subtitle: 'Training Room', description: 'Permanente nesta run', rarity: 'training' },
    { title: `+${TRAINING_BONUS} DEF`, subtitle: 'Training Room', description: 'Permanente nesta run', rarity: 'training' },
  ];
}
