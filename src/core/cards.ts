import { CARD_OFFER_SIZE, CARD_RARITY_WEIGHTS } from './balance';
import { CARDS, type CardId } from './data/cards';
import { maxSkillLevel } from './data/skills';
import type { CoreEvent } from './events';
import { healEntity, updatePlayerStats, type HeroState } from './hero';
import type { Rng } from './rng';
import { getPlayer, type RunState } from './run';

/** Carta ainda faz sentido? Skill no nível máximo ou passiva no limite saem do sorteio. */
export function isCardAvailable(hero: HeroState, id: CardId): boolean {
  const card = CARDS[id];
  if (card.kind === 'skill') return (hero.skills[card.skillId] ?? 0) < maxSkillLevel(card.skillId);
  return (hero.cards[id] ?? 0) < card.maxStacks;
}

/**
 * Sorteia até CARD_OFFER_SIZE cartas diferentes, com peso pela raridade
 * (comum 60, rara 30, épica 10). Ordem estável (ordem de CARDS) antes do
 * sorteio, pra ser determinístico pelo Rng.
 */
export function rollCardOffer(hero: HeroState, rng: Rng): CardId[] {
  const pool = (Object.keys(CARDS) as CardId[]).filter((id) => isCardAvailable(hero, id));
  const offer: CardId[] = [];
  while (offer.length < CARD_OFFER_SIZE && pool.length > 0) {
    const weights = pool.map((id) => CARD_RARITY_WEIGHTS[CARDS[id].rarity]);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng.next() * total;
    let i = 0;
    while (i < pool.length - 1 && roll >= (weights[i] as number)) {
      roll -= weights[i] as number;
      i++;
    }
    offer.push(pool[i] as CardId);
    pool.splice(i, 1);
  }
  return offer;
}

/** Aplica a carta escolhida. */
export function applyCard(state: RunState, id: CardId, events: CoreEvent[]): void {
  const { hero } = state;
  const player = getPlayer(state);
  const card = CARDS[id];

  if (card.kind === 'skill') {
    const level = (hero.skills[card.skillId] ?? 0) + 1;
    hero.skills[card.skillId] = level;
    events.push({ type: 'card-picked', cardId: id, level });
    return;
  }

  const stacks = (hero.cards[id] ?? 0) + 1;
  hero.cards[id] = stacks;
  events.push({ type: 'card-picked', cardId: id, level: stacks });

  switch (card.effect.type) {
    case 'max-hp': {
      player.maxHp += card.effect.amount;
      const amount = healEntity(player, card.effect.amount);
      if (amount > 0) events.push({ type: 'healed', entityId: player.id, amount, hp: player.hp, source: 'card' });
      break;
    }
    case 'max-mana':
      hero.maxMana += card.effect.amount;
      hero.mana += card.effect.amount;
      break;
    case 'atk-pct':
    case 'def':
      updatePlayerStats(hero, player, events);
      break;
    default:
      // Passivas: o efeito é lido na hora (combat.ts, rewards.ts)
      break;
  }
}

/** Abre a escolha de carta se há level up pendente e nenhum outro prompt aberto. */
export function openCardPromptIfPending(state: RunState, rng: Rng, events: CoreEvent[]): void {
  const { hero } = state;
  if (state.prompt || hero.pendingCardPicks <= 0 || state.status !== 'playing') return;
  const offer = rollCardOffer(hero, rng);
  hero.pendingCardPicks -= 1;
  if (offer.length === 0) return; // pool esgotado: só os +10 HP/Mana do nível
  state.prompt = { type: 'card', offer };
  events.push({ type: 'card-offered', offer });
}
