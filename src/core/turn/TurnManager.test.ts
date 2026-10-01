import { describe, expect, it } from 'vitest';
import type { Action } from '../actions';
import { FINAL_FLOOR } from '../balance';
import { setTile, TileType } from '../dungeon/DungeonMap';
import { isAlive } from '../entities/Entity';
import type { CoreEvent } from '../events';
import { createTestRun, getEntity, getPlayer, type RunState } from '../run';
import { resolvePlayerAction } from './TurnManager';

const W: Action = { type: 'move', dir: 'W' };
const E: Action = { type: 'move', dir: 'E' };
const WAIT: Action = { type: 'wait' };

function goblin(state: RunState) {
  const g = getEntity(state, 'goblin-1');
  if (!g) throw new Error('sem goblin');
  return g;
}

/** Joga até alguém morrer, sempre indo pra cima do goblin. */
function fightToTheEnd(state: RunState): CoreEvent[] {
  const all: CoreEvent[] = [];
  for (let i = 0; i < 200 && state.status === 'playing' && isAlive(goblin(state)); i++) {
    all.push(...resolvePlayerAction(state, E).events);
  }
  return all;
}

describe('TurnManager', () => {
  it('bater na parede não gasta turno e o inimigo não age', () => {
    const state = createTestRun(1);
    getPlayer(state).pos = { x: 1, y: 5 };
    const goblinBefore = { ...goblin(state).pos };

    const r = resolvePlayerAction(state, W);

    expect(r.tookTurn).toBe(false);
    expect(state.turn).toBe(0);
    expect(goblin(state).pos).toEqual(goblinBefore);
  });

  it('andar gasta turno e o goblin se aproxima', () => {
    const state = createTestRun(1);
    const r = resolvePlayerAction(state, E);
    expect(r.tookTurn).toBe(true);
    expect(getPlayer(state).pos).toEqual({ x: 4, y: 5 });
    expect(goblin(state).pos).toEqual({ x: 10, y: 5 });
    expect(state.turn).toBe(1);
  });

  it('passar o turno deixa o goblin agir', () => {
    const state = createTestRun(1);
    goblin(state).pos = { x: 10, y: 5 };
    const r = resolvePlayerAction(state, WAIT);
    expect(r.tookTurn).toBe(true);
    expect(r.events[0]).toEqual({ type: 'waited', entityId: 'player' });
    expect(getPlayer(state).pos).toEqual({ x: 3, y: 5 });
    expect(goblin(state).pos).toEqual({ x: 9, y: 5 });
  });

  it('goblin longe demais (fora do aggro) fica parado', () => {
    const state = createTestRun(1);
    // x=3 → x=11: distância 8, acima do AGGRO_RANGE
    resolvePlayerAction(state, WAIT);
    expect(goblin(state).pos).toEqual({ x: 11, y: 5 });
  });

  it('bump ataca só o tile da direção apertada', () => {
    const state = createTestRun(1);
    getPlayer(state).pos = { x: 5, y: 5 };
    goblin(state).pos = { x: 6, y: 5 };

    // Apertar pra cima: anda, não ataca (goblin está à direita)
    const up = resolvePlayerAction(state, { type: 'move', dir: 'N' });
    expect(up.events.some((e) => e.type === 'attacked' && e.attackerId === 'player')).toBe(false);

    // Agora encostar e atacar pela direção certa
    getPlayer(state).pos = { x: 5, y: 5 };
    goblin(state).pos = { x: 6, y: 5 };
    const hit = resolvePlayerAction(state, E);
    const attack = hit.events.find((e) => e.type === 'attacked' && e.attackerId === 'player');
    expect(attack).toBeDefined();
    expect(getPlayer(state).pos).toEqual({ x: 5, y: 5 }); // atacar não move
  });

  it('goblin ataca quando está colado', () => {
    const state = createTestRun(1);
    goblin(state).pos = { x: 4, y: 5 };
    const r = resolvePlayerAction(state, WAIT);
    const hit = r.events.find((e) => e.type === 'attacked' && e.attackerId === 'goblin-1');
    expect(hit).toBeDefined();
    // Goblin ATK 3 → faixa 2–4, menos DEF 5 → sempre o piso de 1
    if (hit?.type === 'attacked') expect(hit.damage).toBe(1);
    expect(getPlayer(state).hp).toBe(49);
  });

  it('Knight mata o Goblin dummy e a run continua (vitória só na escada final)', () => {
    const state = createTestRun(42);
    const events = fightToTheEnd(state);
    expect(events).toContainEqual({ type: 'died', entityId: 'goblin-1' });
    expect(goblin(state).hp).toBe(0);
    expect(state.status).toBe('playing');
  });

  it('pisar na escada do andar final termina a run em vitória', () => {
    const state = createTestRun(42);
    state.floor = FINAL_FLOOR;
    setTile(state.map, { x: 2, y: 5 }, TileType.STAIRS);
    const r = resolvePlayerAction(state, W);
    expect(state.status).toBe('won');
    expect(r.events.at(-1)).toEqual({ type: 'victory' });
  });

  it('depois do fim, nenhuma ação tem efeito', () => {
    const state = createTestRun(42);
    getPlayer(state).hp = 0;
    state.status = 'lost';
    const r = resolvePlayerAction(state, W);
    expect(r).toEqual({ tookTurn: false, reason: 'not-playing', events: [] });
  });

  it('player com HP baixo morre e a run termina em derrota', () => {
    const state = createTestRun(3);
    const p = getPlayer(state);
    p.hp = 1;
    goblin(state).pos = { x: 4, y: 5 };
    const r = resolvePlayerAction(state, WAIT);
    expect(state.status).toBe('lost');
    expect(r.events).toContainEqual({ type: 'died', entityId: 'player' });
    expect(r.events.at(-1)).toEqual({ type: 'defeat' });
  });

  it('skills e inventário ainda não gastam turno (Marco 2/3)', () => {
    const state = createTestRun(1);
    expect(resolvePlayerAction(state, { type: 'skill', slot: 1 }).tookTurn).toBe(false);
    expect(resolvePlayerAction(state, { type: 'inventory' }).tookTurn).toBe(false);
  });

  it('mesmo seed + mesmas ações → mesmo combate', () => {
    const a = createTestRun(777);
    const b = createTestRun(777);
    expect(fightToTheEnd(a)).toEqual(fightToTheEnd(b));
  });

  it('estado salvo no meio da luta continua idêntico (base do save)', () => {
    const live = createTestRun(2024);
    for (let i = 0; i < 6; i++) resolvePlayerAction(live, E);
    const restored = JSON.parse(JSON.stringify(live)) as RunState;
    expect(fightToTheEnd(restored)).toEqual(fightToTheEnd(live));
  });
});
