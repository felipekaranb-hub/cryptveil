import { describe, expect, it } from 'vitest';
import { CARD_OFFER_SIZE, META } from '../balance';
import { ENTITY_TEMPLATES } from '../data/entities';
import { createEntity } from '../entities/Entity';
import { createRun, createTestRun, getPlayer, type RunState } from '../run';
import { deserializeRun, serializeRun } from '../save/runSave';
import { resolvePlayerAction } from '../turn/TurnManager';
import {
  applyRunResult,
  buyUpgrade,
  conversionRate,
  createMeta,
  deserializeMeta,
  maxedMeta,
  nextUpgradeCost,
  NO_BONUSES,
  runBonuses,
  serializeMeta,
  type RunBonuses,
} from './metaProgress';

/** Rat de 1 HP colado à direita do Knight. */
function withRatToKill(state: RunState): void {
  getPlayer(state).pos = { x: 7, y: 5 };
  const rat = createEntity('r', ENTITY_TEMPLATES.rat, { x: 8, y: 5 });
  rat.hp = 1;
  rat.homeRoom = 0;
  state.entities = [getPlayer(state), rat];
}

describe('Sanctum: comprar upgrade', () => {
  it('cobra o preço do próximo nível e para no máximo', () => {
    const meta = createMeta();
    meta.gold = 1000;
    expect(buyUpgrade(meta, 'vault')).toBe(true);
    expect(meta.gold).toBe(1000 - (META.costs.vault[0] as number));
    expect(meta.upgrades.vault).toBe(1);
    expect(buyUpgrade(meta, 'vault')).toBe(true);
    expect(buyUpgrade(meta, 'vault')).toBe(true);
    expect(nextUpgradeCost(meta, 'vault')).toBeNull();
    expect(buyUpgrade(meta, 'vault')).toBe('maxed');
  });

  it('sem gold não compra nem desconta', () => {
    const meta = createMeta();
    meta.gold = 10;
    expect(buyUpgrade(meta, 'sharpen')).toBe('no-gold');
    expect(meta.gold).toBe(10);
    expect(meta.upgrades.sharpen).toBeUndefined();
  });
});

describe('conversão do gold', () => {
  it('vitória converte 100%; morte 50%, e o Vault sobe até 80%', () => {
    const meta = createMeta();
    expect(conversionRate(meta, true)).toBe(1);
    expect(conversionRate(meta, false)).toBe(0.5);
    meta.upgrades.vault = 3;
    expect(conversionRate(meta, false)).toBe(0.8);
  });

  it('fecha a run: soma gold convertido, kills, recordes', () => {
    const meta = createMeta();
    const run = createRun(5);
    run.hero.gold = 81;
    run.floor = 3;
    run.runStats.kills = { Rat: 4, Orc: 2, Goblin: 1 };
    const summary = applyRunResult(meta, run, 'lost');
    expect(summary.converted).toBe(40); // 50% de 81, pra baixo
    expect(meta.gold).toBe(40);
    expect(meta.kills).toEqual({ rat: 4, goblin: 1, orc: 2 });
    expect(summary.kills.map((k) => k.species)).toEqual(['rat', 'goblin', 'orc']);
    expect(meta).toMatchObject({ runs: 1, wins: 0, bestFloor: 3 });

    run.floor = 2;
    run.hero.gold = 30;
    applyRunResult(meta, run, 'won');
    expect(meta).toMatchObject({ gold: 70, runs: 2, wins: 1, bestFloor: 3 });
    expect(meta.kills.rat).toBe(8);
  });

  it('run abandonada conta como morte', () => {
    const meta = createMeta();
    const run = createRun(5);
    run.hero.gold = 100;
    expect(applyRunResult(meta, run, 'abandoned').converted).toBe(50);
  });
});

describe('bônus na run nova', () => {
  it('sem meta, a run é idêntica à de antes do Sanctum', () => {
    expect(createRun(77, NO_BONUSES)).toEqual(createRun(77));
    expect(runBonuses(createMeta())).toEqual(NO_BONUSES);
  });

  it('Armory: +ATK e +HP max desde o turno 0; o mapa não muda', () => {
    const base = createRun(77);
    const run = createRun(77, { ...NO_BONUSES, atk: 2, maxHp: 20 });
    expect(getPlayer(run).atk).toBe(getPlayer(base).atk + 2);
    expect(getPlayer(run).maxHp).toBe(getPlayer(base).maxHp + 20);
    expect(getPlayer(run).hp).toBe(getPlayer(run).maxHp);
    expect(run.map).toEqual(base.map);
    expect(run.entities.slice(1)).toEqual(base.entities.slice(1));
  });

  it('Saber 2: a run começa com uma escolha de carta aberta, de 4 opções com o Saber 1', () => {
    const bonuses = runBonuses({ ...createMeta(), upgrades: { wisdom: 2 } });
    const run = createRun(77, bonuses);
    expect(run.prompt?.type).toBe('card');
    expect(run.prompt?.type === 'card' && run.prompt.offer).toHaveLength(CARD_OFFER_SIZE + 1);
    expect(run.hero.bonusOfferCards).toBe(0);
    expect(run.map).toEqual(createRun(77).map);
    // e a escolha funciona e não gasta turno
    expect(resolvePlayerAction(run, { type: 'choose', index: 0 })).toMatchObject({ reason: 'free-action' });
    expect(run.prompt).toBeNull();
    expect(run.turn).toBe(0);
  });

  it('Saber 1: só a primeira escolha da run tem a carta extra', () => {
    const state = createTestRun(1);
    state.hero.bonusOfferCards = 1;
    withRatToKill(state);
    state.hero.xp = 7;
    resolvePlayerAction(state, { type: 'move', dir: 'E' });
    expect(state.prompt?.type === 'card' && state.prompt.offer).toHaveLength(CARD_OFFER_SIZE + 1);
    resolvePlayerAction(state, { type: 'choose', index: 0 });
    state.hero.pendingCardPicks = 1;
    withRatToKill(state);
    resolvePlayerAction(state, { type: 'wait' });
    expect(state.prompt?.type === 'card' && state.prompt.offer).toHaveLength(CARD_OFFER_SIZE);
  });

  it('Saber 3: +15% de XP por kill', () => {
    const plain = createTestRun(1);
    const wise = createTestRun(1);
    wise.hero.xpBonusPct = META.wisdomXpPct;
    for (const s of [plain, wise]) {
      withRatToKill(s);
      resolvePlayerAction(s, { type: 'move', dir: 'E' });
    }
    const ratXp = ENTITY_TEMPLATES.rat.reward.xp;
    expect(plain.hero.xp).toBe(ratXp);
    expect(wise.hero.xp).toBe(Math.round(ratXp * (1 + META.wisdomXpPct)));
  });

  it('kills do player entram nas estatísticas da run', () => {
    const state = createTestRun(1);
    withRatToKill(state);
    resolvePlayerAction(state, { type: 'move', dir: 'E' });
    expect(state.runStats.kills).toEqual({ Rat: 1 });
  });
});

describe('Releitura: rerrolar a escolha de carta', () => {
  const withRerolls = (rerolls: number): RunBonuses => ({ ...NO_BONUSES, startingCard: true, rerolls });

  it('troca as cartas por outras, não gasta turno e consome a rerrolagem', () => {
    const run = createRun(9, withRerolls(1));
    const before = run.prompt?.type === 'card' ? [...run.prompt.offer] : [];
    const r = resolvePlayerAction(run, { type: 'reroll' });
    expect(r).toMatchObject({ tookTurn: false, reason: 'free-action' });
    const after = run.prompt?.type === 'card' ? run.prompt.offer : [];
    expect(after).toHaveLength(before.length);
    expect(after.some((id) => before.includes(id))).toBe(false);
    expect(run.hero.rerolls).toBe(0);
    expect(run.turn).toBe(0);
    expect(resolvePlayerAction(run, { type: 'reroll' })).toMatchObject({ tookTurn: false, reason: 'no-rerolls' });
  });

  it('sem escolha aberta não faz nada', () => {
    const state = createTestRun(1);
    state.hero.rerolls = 2;
    expect(resolvePlayerAction(state, { type: 'reroll' })).toMatchObject({ tookTurn: false });
    expect(state.hero.rerolls).toBe(2);
  });

  it('o save guarda as rerrolagens e a escolha aberta', () => {
    const run = createRun(9, withRerolls(3));
    resolvePlayerAction(run, { type: 'reroll' });
    expect(deserializeRun(serializeRun(run))).toEqual(run);
  });
});

describe('save da meta', () => {
  it('ida e volta', () => {
    const meta = maxedMeta();
    meta.gold = 12;
    meta.kills = { rat: 3 };
    expect(deserializeMeta(serializeMeta(meta))).toEqual(meta);
  });

  it('rejeita lixo, versão desconhecida e números inválidos', () => {
    expect(deserializeMeta('{')).toBeNull();
    expect(deserializeMeta(JSON.stringify({ ...createMeta(), version: 99 }))).toBeNull();
    expect(deserializeMeta(JSON.stringify({ ...createMeta(), gold: -5 }))).toBeNull();
    expect(deserializeMeta(JSON.stringify({ ...createMeta(), upgrades: { vault: 'x' } }))).toBeNull();
  });
});
