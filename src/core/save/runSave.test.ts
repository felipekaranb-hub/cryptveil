import { describe, expect, it } from 'vitest';
import { createRun, createTestRun, getPlayer, RUN_STATE_VERSION } from '../run';
import { resolvePlayerAction } from '../turn/TurnManager';
import { deserializeRun, serializeRun } from './runSave';

describe('save da run', () => {
  it('ida e volta devolve o mesmo estado', () => {
    const state = createRun(48213);
    for (let i = 0; i < 5; i++) resolvePlayerAction(state, { type: 'wait' });
    expect(deserializeRun(serializeRun(state))).toEqual(state);
  });

  it('run restaurada continua idêntica à original (inclusive os sorteios)', () => {
    const live = createTestRun(2024);
    const goblin = live.entities[1]!;
    goblin.pos = { x: 6, y: 5 };
    resolvePlayerAction(live, { type: 'move', dir: 'E' });
    const restored = deserializeRun(serializeRun(live));
    if (!restored) throw new Error('save inválido');
    const E = { type: 'move', dir: 'E' } as const;
    for (let i = 0; i < 10; i++) {
      expect(resolvePlayerAction(restored, E)).toEqual(resolvePlayerAction(live, E));
    }
  });

  it('run que acabou não vira save (morte apaga a run)', () => {
    const state = createRun(1);
    getPlayer(state).hp = 0;
    state.status = 'lost';
    expect(deserializeRun(serializeRun(state))).toBeNull();
  });

  it('save da versão 1 (Marco 1) é descartado', () => {
    const v1 = { ...createTestRun(1), version: 1 };
    expect(deserializeRun(JSON.stringify(v1))).toBeNull();
  });

  it('versão desconhecida, lixo ou save corrompido → null', () => {
    expect(deserializeRun('{')).toBeNull();
    expect(deserializeRun('null')).toBeNull();
    expect(deserializeRun('[]')).toBeNull();
    expect(deserializeRun(JSON.stringify({ ...createRun(1), version: 99 }))).toBeNull();

    const broken = createRun(1);
    broken.map = { ...broken.map, tiles: broken.map.tiles.slice(1) };
    expect(deserializeRun(serializeRun(broken))).toBeNull();

    const noPlayer = createRun(1);
    noPlayer.entities = noPlayer.entities.filter((e) => e.kind !== 'player');
    expect(deserializeRun(JSON.stringify(noPlayer))).toBeNull();
  });
});

describe('migração do save', () => {
  it('save v2 (Marco 2a) migra até a versão atual com o herói inicial e continua jogável', () => {
    const v4 = createRun(48213);
    const { hero: _hero, visitedRooms: _v, clearedRooms: _c, prompt: _p, ...rest } = v4;
    const v2 = { ...rest, version: 2 };
    const migrated = deserializeRun(JSON.stringify(v2));
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(RUN_STATE_VERSION);
    expect(migrated!.hero.skills).toEqual({ brutalStrike: 1, berserk: 1, whirlwindThrow: 1, woundCleansing: 1 });
    expect(migrated!.hero.equipment).toEqual({ weapon: 'sword' });
    expect(migrated!.clearedRooms).toEqual([]);
    expect(resolvePlayerAction(migrated!, { type: 'wait' }).tookTurn).toBe(true);
  });
});

describe('migração v3 → v4', () => {
  it('prompt de Training Room vira objeto, Knight mantém as 4 skills, sem cartas', () => {
    const state = createRun(5);
    const { skills: _s, cards: _c, pendingCardPicks: _p, ...hero } = state.hero;
    const v3 = { ...state, version: 3, prompt: 'training', hero };
    const migrated = deserializeRun(JSON.stringify(v3));
    expect(migrated!.prompt).toEqual({ type: 'training' });
    expect(migrated!.hero.cards).toEqual({});
    expect(migrated!.hero.skills.woundCleansing).toBe(1);
  });
});

describe('migração v4 → v5', () => {
  it('ganha a fog of war com a sala atual revelada e continua idêntica no resto', () => {
    const state = createRun(11);
    const { explored, ...rest } = state;
    const v4 = { ...rest, version: 4 };
    const migrated = deserializeRun(JSON.stringify(v4));
    expect(migrated!.version).toBe(RUN_STATE_VERSION);
    expect(migrated!.explored).toEqual(explored);
    expect(migrated!.hero).toEqual(state.hero);
  });

  it('save sem explored válido é rejeitado', () => {
    const broken = { ...createRun(11), explored: 'x' };
    expect(deserializeRun(JSON.stringify(broken))).toBeNull();
  });
});

describe('migração v5 → v6', () => {
  it('ganha relíquias vazias, sem mercador e sem escada escondida, e continua jogável', () => {
    const state = createRun(21);
    const { merchant: _m, hiddenStairs: _h, ...rest } = state;
    const { relics: _r, ...hero } = state.hero;
    const v5 = { ...rest, hero, version: 5 };
    const migrated = deserializeRun(JSON.stringify(v5));
    expect(migrated!.version).toBe(RUN_STATE_VERSION);
    expect(migrated!.hero.relics).toEqual([]);
    expect(migrated!.merchant).toBeNull();
    expect(migrated!.hiddenStairs).toBeNull();
    expect(resolvePlayerAction(migrated!, { type: 'wait' }).tookTurn).toBe(true);
  });
});

describe('migração v6 → v7', () => {
  it('herói sem bônus de meta, kills zeradas, e continua jogável', () => {
    const state = createRun(31);
    const { runStats: _s, ...rest } = state;
    const { xpBonusPct: _x, bonusOfferCards: _b, rerolls: _r, ...hero } = state.hero;
    const v6 = { ...rest, hero, version: 6 };
    const migrated = deserializeRun(JSON.stringify(v6));
    expect(migrated!.version).toBe(RUN_STATE_VERSION);
    expect(migrated!.runStats).toEqual({ kills: {} });
    expect(migrated!.hero).toEqual(state.hero);
    expect(resolvePlayerAction(migrated!, { type: 'wait' }).tookTurn).toBe(true);
  });

  it('save sem runStats é rejeitado', () => {
    const { runStats: _s, ...broken } = createRun(31);
    expect(deserializeRun(JSON.stringify(broken))).toBeNull();
  });
});

describe('migração v7 → v8', () => {
  it('ganha recargas vazias e continua jogável', () => {
    const state = createRun(41);
    const { cooldowns: _c, ...hero } = state.hero;
    const migrated = deserializeRun(JSON.stringify({ ...state, hero, version: 7 }));
    expect(migrated!.version).toBe(RUN_STATE_VERSION);
    expect(migrated!.hero).toEqual(state.hero);
    expect(resolvePlayerAction(migrated!, { type: 'wait' }).tookTurn).toBe(true);
  });
});
