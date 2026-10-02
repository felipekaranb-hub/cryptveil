import { describe, expect, it } from 'vitest';
import { CARD_OFFER_SIZE, MANA_PER_KILL } from './balance';
import { applyCard, isCardAvailable, rollCardOffer } from './cards';
import { CARDS, type CardId } from './data/cards';
import { ENTITY_TEMPLATES } from './data/entities';
import { createEntity } from './entities/Entity';
import type { CoreEvent } from './events';
import { xpToNextLevel } from './hero';
import { Rng } from './rng';
import { createTestRun, getPlayer, type RunState } from './run';
import { resolvePlayerAction } from './turn/TurnManager';

function withGoblinToKill(state: RunState, hp = 1): void {
  getPlayer(state).pos = { x: 7, y: 5 };
  const g = createEntity('g', ENTITY_TEMPLATES.goblinDummy, { x: 8, y: 5 });
  g.hp = hp;
  g.homeRoom = 0;
  state.entities = [getPlayer(state), g];
}

describe('cartas: estado inicial', () => {
  it('o Knight começa só com o Brutal Strike', () => {
    const state = createTestRun(1);
    expect(state.hero.skills).toEqual({ brutalStrike: 1 });
    expect(resolvePlayerAction(state, { type: 'skill', slot: 2 })).toMatchObject({ tookTurn: false, reason: 'skill-locked' });
  });
});

describe('sorteio', () => {
  it(`oferece ${CARD_OFFER_SIZE} cartas diferentes e é determinístico`, () => {
    const hero = createTestRun(1).hero;
    const a = rollCardOffer(hero, Rng.fromSeed(9));
    expect(a).toHaveLength(CARD_OFFER_SIZE);
    expect(new Set(a).size).toBe(CARD_OFFER_SIZE);
    expect(rollCardOffer(hero, Rng.fromSeed(9))).toEqual(a);
  });

  it('Wound Cleansing (épica) é a mais rara; comuns aparecem mais', () => {
    const hero = createTestRun(1).hero;
    const rng = Rng.fromSeed(1);
    const seen: Partial<Record<CardId, number>> = {};
    for (let i = 0; i < 3000; i++) for (const id of rollCardOffer(hero, rng)) seen[id] = (seen[id] ?? 0) + 1;
    expect(seen.skillWoundCleansing!).toBeLessThan(seen.skillBerserk!);
    expect(seen.skillBerserk!).toBeLessThan(seen.might!);
  });

  it('skill no nível máximo e passiva no limite saem do sorteio', () => {
    const hero = createTestRun(1).hero;
    hero.skills.brutalStrike = 3;
    hero.cards.vampirism = 1;
    expect(isCardAvailable(hero, 'skillBrutalStrike')).toBe(false);
    expect(isCardAvailable(hero, 'vampirism')).toBe(false);
    const rng = Rng.fromSeed(2);
    for (let i = 0; i < 200; i++) {
      const offer = rollCardOffer(hero, rng);
      expect(offer).not.toContain('skillBrutalStrike');
      expect(offer).not.toContain('vampirism');
    }
  });
});

describe('aplicar carta', () => {
  it('carta de skill libera; repetida sobe o nível e muda os números', () => {
    const state = createTestRun(1);
    const events: CoreEvent[] = [];
    applyCard(state, 'skillBerserk', events);
    expect(state.hero.skills.berserk).toBe(1);
    applyCard(state, 'skillBrutalStrike', events);
    expect(state.hero.skills.brutalStrike).toBe(2);
    expect(events).toContainEqual({ type: 'card-picked', cardId: 'skillBrutalStrike', level: 2 });

    // Brutal Strike II custa 3
    withGoblinToKill(state, 999);
    state.hero.mana = 3;
    expect(resolvePlayerAction(state, { type: 'skill', slot: 1 }).tookTurn).toBe(true);
    expect(state.hero.mana).toBe(0);
  });

  it('Força multiplica o ATK; Guarda soma DEF; Vigor sobe HP e cura', () => {
    const state = createTestRun(1);
    const p = getPlayer(state);
    applyCard(state, 'might', []);
    expect(p.atk).toBe(13); // 11 × 1,15 = 12,65 → 13
    applyCard(state, 'guard', []);
    expect(p.def).toBe(7);
    p.hp = 10;
    applyCard(state, 'vigor', []);
    expect(p.maxHp).toBe(70);
    expect(p.hp).toBe(30);
  });

  it('Pele de Ferro reduz o dano recebido (mínimo 1)', () => {
    const state = createTestRun(3);
    applyCard(state, 'ironSkin', []);
    applyCard(state, 'ironSkin', []);
    withGoblinToKill(state, 999);
    getPlayer(state).def = 0;
    const r = resolvePlayerAction(state, { type: 'wait' });
    const hit = r.events.find((e) => e.type === 'attacked' && e.targetId === 'player');
    // Goblin ATK 3 rola 2–4, DEF 0, −4 → piso 1
    expect(hit).toMatchObject({ damage: 1 });
  });

  it('Vampirismo cura parte do dano causado', () => {
    const state = createTestRun(1);
    applyCard(state, 'vampirism', []);
    withGoblinToKill(state, 999);
    getPlayer(state).hp = 10;
    const r = resolvePlayerAction(state, { type: 'move', dir: 'E' });
    expect(r.events.some((e) => e.type === 'healed' && e.source === 'vampirism')).toBe(true);
  });

  it('Golpe Crítico às vezes dobra o dano', () => {
    let crits = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const state = createTestRun(seed);
      applyCard(state, 'critical', []);
      withGoblinToKill(state, 999);
      const r = resolvePlayerAction(state, { type: 'move', dir: 'E' });
      if (r.events.some((e) => e.type === 'attacked' && e.critical)) crits++;
    }
    expect(crits).toBeGreaterThan(10); // ~15% de 200
    expect(crits).toBeLessThan(60);
  });

  it('Contra-ataque revida às vezes quando apanha', () => {
    let counters = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const state = createTestRun(seed);
      applyCard(state, 'counter', []);
      withGoblinToKill(state, 999);
      const r = resolvePlayerAction(state, { type: 'wait' });
      if (r.events.some((e) => e.type === 'countered')) counters++;
    }
    expect(counters).toBeGreaterThan(20); // ~25% de 200
    expect(counters).toBeLessThan(80);
  });

  it('Caçador e Sede de Sangue aumentam o que o kill rende', () => {
    const state = createTestRun(1);
    applyCard(state, 'hunter', []);
    applyCard(state, 'bloodthirst', []);
    withGoblinToKill(state);
    state.hero.mana = 0;
    const r = resolvePlayerAction(state, { type: 'move', dir: 'E' });
    expect(r.events.find((e) => e.type === 'rewarded')).toMatchObject({ xp: 6 }); // 4 + 2
    expect(state.hero.mana).toBe(MANA_PER_KILL + 3); // kill + Sede de Sangue
  });
});

describe('level up → escolha de carta', () => {
  it('subir de nível abre a escolha; escolher aplica e fecha, sem gastar turno', () => {
    const state = createTestRun(1);
    withGoblinToKill(state);
    state.hero.xp = xpToNextLevel(1) - 1;
    const r = resolvePlayerAction(state, { type: 'move', dir: 'E' });
    const offered = r.events.find((e) => e.type === 'card-offered');
    expect(offered).toBeDefined();
    expect(state.prompt?.type).toBe('card');

    // Travado até escolher
    expect(resolvePlayerAction(state, { type: 'wait' })).toMatchObject({ reason: 'awaiting-choice' });

    const turn = state.turn;
    const offer = state.prompt?.type === 'card' ? state.prompt.offer : [];
    const c = resolvePlayerAction(state, { type: 'choose', index: 1 });
    expect(c).toMatchObject({ tookTurn: false, reason: 'free-action' });
    expect(c.events[0]).toEqual({ type: 'card-picked', cardId: offer[1], level: 1 });
    expect(state.prompt).toBeNull();
    expect(state.turn).toBe(turn);
  });

  it('dois níveis de uma vez → duas escolhas seguidas', () => {
    const state = createTestRun(1);
    withGoblinToKill(state);
    state.hero.pendingCardPicks = 1; // um nível já pendente
    state.hero.xp = xpToNextLevel(1) - 1;
    resolvePlayerAction(state, { type: 'move', dir: 'E' });
    expect(state.prompt?.type).toBe('card');
    const second = resolvePlayerAction(state, { type: 'choose', index: 0 });
    expect(second.events.some((e) => e.type === 'card-offered')).toBe(true);
    resolvePlayerAction(state, { type: 'choose', index: 0 });
    expect(state.prompt).toBeNull();
    expect(state.hero.pendingCardPicks).toBe(0);
  });

  it('todas as cartas têm dados coerentes', () => {
    for (const [id, card] of Object.entries(CARDS)) {
      if (card.kind === 'boon') expect(card.maxStacks, id).toBeGreaterThanOrEqual(1);
    }
  });
});
