import { describe, expect, it } from 'vitest';
import { createTestRun, getPlayer } from '../run';
import { resolvePlayerAction } from '../turn/TurnManager';

/** Sala de teste sem monstros (o turno passa sem ninguém bater). */
function emptyRun() {
  const state = createTestRun(1);
  state.entities = [getPlayer(state)];
  return state;
}

describe('inventário: equipar, desequipar e usar', () => {
  it('equipar da mochila veste o item, devolve o antigo pra mochila, recalcula ATK e gasta turno', () => {
    const state = emptyRun();
    state.hero.bag.push('spikeSword');
    const r = resolvePlayerAction(state, { type: 'equip', itemId: 'spikeSword' });
    expect(r.tookTurn).toBe(true);
    expect(state.hero.equipment.weapon).toBe('spikeSword');
    expect(state.hero.bag).toEqual(['sword']);
    expect(getPlayer(state).atk).toBe(15);
    expect(r.events).toContainEqual({ type: 'equipped', itemId: 'spikeSword' });
    expect(r.events).toContainEqual({ type: 'stats-changed', atk: { from: 10, to: 15 }, def: { from: 5, to: 5 } });
    expect(state.turn).toBe(1);
  });

  it('dá pra voltar pra um item pior (o auto-equip não impede a escolha)', () => {
    const state = emptyRun();
    state.hero.bag.push('spikeSword');
    resolvePlayerAction(state, { type: 'equip', itemId: 'spikeSword' });
    resolvePlayerAction(state, { type: 'equip', itemId: 'sword' });
    expect(state.hero.equipment.weapon).toBe('sword');
    expect(getPlayer(state).atk).toBe(10);
  });

  it('desequipar guarda na mochila e tira o bônus', () => {
    const state = emptyRun();
    const r = resolvePlayerAction(state, { type: 'unequip', slot: 'weapon' });
    expect(r.tookTurn).toBe(true);
    expect(state.hero.equipment.weapon).toBeUndefined();
    expect(state.hero.bag).toEqual(['sword']);
    expect(getPlayer(state).atk).toBe(7);
  });

  it('falhas não gastam turno nem mudam nada', () => {
    const state = emptyRun();
    expect(resolvePlayerAction(state, { type: 'equip', itemId: 'spikeSword' })).toMatchObject({ tookTurn: false, reason: 'no-item' });
    expect(resolvePlayerAction(state, { type: 'unequip', slot: 'helmet' })).toMatchObject({ tookTurn: false, reason: 'empty-slot' });
    state.hero.bag.push('hpPotion');
    expect(resolvePlayerAction(state, { type: 'equip', itemId: 'hpPotion' })).toMatchObject({ tookTurn: false, reason: 'cannot-equip' });
    expect(resolvePlayerAction(state, { type: 'use-item', itemId: 'hpPotion' })).toMatchObject({ tookTurn: false, reason: 'full-hp' });
    expect(state.turn).toBe(0);
    expect(state.hero.bag).toEqual(['hpPotion']);
  });

  it('usar poção pelo inventário cura e gasta turno', () => {
    const state = emptyRun();
    state.hero.bag.push('hpPotion');
    getPlayer(state).hp = 10;
    const r = resolvePlayerAction(state, { type: 'use-item', itemId: 'hpPotion' });
    expect(r.tookTurn).toBe(true);
    expect(getPlayer(state).hp).toBeGreaterThan(10);
    expect(state.hero.bag).toEqual([]);
  });

  it('item de outra vocação não veste', () => {
    const state = emptyRun();
    // Nenhum item do MVP é de outra vocação ainda: troca a vocação pra testar a regra (§2.5)
    state.hero = { ...state.hero, vocation: 'SORCERER', bag: ['spikeSword'] };
    expect(resolvePlayerAction(state, { type: 'equip', itemId: 'spikeSword' })).toMatchObject({
      tookTurn: false,
      reason: 'cannot-equip',
    });
  });
});
