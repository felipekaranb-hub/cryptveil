import { TRAINING_BONUS } from '../core/balance';
import { CARDS, type CardId } from '../core/data/cards';
import { getItem } from '../core/data/items';
import { KNIGHT_HOTBAR, resolveSkill, SKILLS, skillSummary } from '../core/data/skills';
import { countInBag, type HeroState } from '../core/hero';
import type { CoreEvent } from '../core/events';
import { getEntity, type RunState } from '../core/run';
import type { TurnResult } from '../core/turn/TurnManager';
import type { ChoiceOption } from './events';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'] as const;
const roman = (n: number): string => ROMAN[n] ?? String(n);

/**
 * Texto do LOG de combate a partir dos eventos do core.
 * Fica na view porque é apresentação (idioma, tom); o core só diz o que houve.
 */
export function formatEvent(event: CoreEvent, state: RunState): string | null {
  const name = (id: string): string => getEntity(state, id)?.name ?? id;
  switch (event.type) {
    case 'attacked':
      return `${name(event.attackerId)} acerta ${name(event.targetId)}: ${event.damage}${event.critical ? ' (crítico!)' : ''}`;
    case 'countered':
      return 'Contra-ataque!';
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
      if (event.source === 'passive') return `+${event.amount} HP (kill)`;
      if (event.source === 'vampirism') return `+${event.amount} HP (vampirismo)`;
      return `Recupera ${event.amount} HP`;
    case 'mana-restored':
      return `Recupera ${event.amount} de mana`;
    case 'rewarded':
      return `+${event.xp} XP  +${event.gold} gold`;
    case 'leveled-up':
      return `Subiu para o nível ${event.level}!`;
    case 'looted':
      return event.equipped ? `Equipou ${getItem(event.itemId).name}` : `Pegou ${getItem(event.itemId).name}`;
    case 'room-cleared':
      // Sem contador: a regra da sala de treino é implícita (decisão do Felipe, Marco 2d)
      return 'Sala explorada';
    case 'training-offered':
      return 'Training Room: escolha +2 ATK ou +2 DEF';
    case 'trained':
      return `Treinou: +${event.amount} ${event.stat.toUpperCase()}`;
    case 'card-offered':
      return 'Subiu de nível: escolha uma carta';
    case 'card-picked': {
      const card = CARDS[event.cardId];
      if (card.kind === 'skill') {
        const skillName = SKILLS[card.skillId].name;
        return event.level === 1 ? `Nova skill: ${skillName}` : `${skillName} ${roman(event.level)}`;
      }
      return card.maxStacks > 1 ? `Carta: ${card.name} (${event.level}/${card.maxStacks})` : `Carta: ${card.name}`;
    }
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
      return 'Você não tem essa poção';
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

const RARITY_LABEL = { common: 'Comum', rare: 'Rara', epic: 'Épica' } as const;

export function describeTraining(): ChoiceOption[] {
  return [
    { title: `+${TRAINING_BONUS} ATK`, subtitle: 'Training Room', description: 'Permanente nesta run', rarity: 'training' },
    { title: `+${TRAINING_BONUS} DEF`, subtitle: 'Training Room', description: 'Permanente nesta run', rarity: 'training' },
  ];
}

/** Linha da hotbar: skill liberada com nível e custo; slot travado vira "—". */
export function formatHotbar(hero: HeroState): string {
  const parts: string[] = [];
  for (const [slot, entry] of Object.entries(KNIGHT_HOTBAR)) {
    if (!entry) continue;
    if (entry.type === 'skill') {
      const level = hero.skills[entry.id];
      if (!level) {
        parts.push(`${slot} —`);
        continue;
      }
      const lv = level > 1 ? ` ${roman(level)}` : '';
      parts.push(`${slot} ${SKILLS[entry.id].name}${lv} (${resolveSkill(entry.id, level).manaCost})`);
    } else {
      const label = entry.id === 'hpPotion' ? 'Poção HP' : 'Poção Mana';
      parts.push(`${slot} ${label} ×${countInBag(hero, entry.id)}`);
    }
  }
  return parts.join('  ·  ');
}
