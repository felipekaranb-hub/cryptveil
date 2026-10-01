import { TRAINING_BONUS } from '../core/balance';
import { CARDS, type CardId } from '../core/data/cards';
import { getItem } from '../core/data/items';
import { RELICS } from '../core/data/relics';
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
    case 'attacked': {
      const crit = event.critical ? ' (crítico!)' : '';
      const tone = event.targetId === state.playerId ? 'danger' : 'normal';
      if (event.ranged) {
        return line(`${name(event.attackerId)} arremessa ${event.ranged.projectile}: ${event.damage}${crit}`, tone);
      }
      return line(`${name(event.attackerId)} acerta ${name(event.targetId)}: ${event.damage}${crit}`, tone);
    }
    case 'summoned':
      return line(`${name(event.by)} convoca um ${name(event.entityId)}!`, 'danger');
    case 'enraged':
      return line(`${name(event.entityId)} enfurece! (dano ×1,5)`, 'danger');
    case 'stairs-revealed':
      return line('A escada apareceu!', 'level');
    case 'shop-opened':
      return line('Mercador: "O que vai ser, aventureiro?"', 'loot');
    case 'shop-closed':
      return null;
    case 'bought':
      return line(
        `Comprou ${event.item.kind === 'relic' ? RELICS[event.item.relicId].name : getItem(event.item.itemId).name} (−${event.price}g)`,
        'loot',
      );
    case 'sold':
      return line(`Vendeu ${getItem(event.itemId).name}${event.count > 1 ? ` ×${event.count}` : ''} (+${event.price}g)`, 'loot');
    case 'countered':
      return line('Contra-ataque!');
    case 'died':
      // A morte do player sai uma vez só, no 'defeat'
      return event.entityId === state.playerId ? null : line(`${name(event.entityId)} morreu`, 'good');
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
      // Orc invocado pelo boss não dá gold: mostra só o XP
      return line(event.gold > 0 ? `+${event.xp} XP  +${event.gold} gold` : `+${event.xp} XP`, 'loot');
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
    case 'no-gold':
      return 'Gold insuficiente';
    case 'relics-full':
      return 'Os 3 slots de relíquia estão cheios';
    case 'no-offer':
      return 'O mercador não tem isso';
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
