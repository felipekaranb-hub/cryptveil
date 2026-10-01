import { describe, expect, it } from 'vitest';
import { createRun, createTestRun, getPlayer } from '../run';
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
  it('save v2 (Marco 2a) vira v3 com o herói inicial e continua jogável', () => {
    const v3 = createRun(48213);
    const { hero: _hero, visitedRooms: _v, clearedRooms: _c, prompt: _p, ...rest } = v3;
    const v2 = { ...rest, version: 2 };
    const migrated = deserializeRun(JSON.stringify(v2));
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(3);
    expect(migrated!.hero.equipment).toEqual({ weapon: 'sword' });
    expect(migrated!.clearedRooms).toEqual([]);
    expect(resolvePlayerAction(migrated!, { type: 'wait' }).tookTurn).toBe(true);
  });
});
