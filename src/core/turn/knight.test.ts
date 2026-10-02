import { describe, expect, it } from 'vitest';
import type { Action } from '../actions';
import { KILL_HEAL, KNIGHT_START_MANA, MANA_PER_KILL, ROOMS_PER_TRAINING, TRAINING_BONUS } from '../balance';
import { damageRange, mitigate } from '../combat/damage';
import { ENTITY_TEMPLATES } from '../data/entities';
import { getTile, setTile, TileType } from '../dungeon/DungeonMap';
import { createEntity, type Entity } from '../entities/Entity';
import type { CoreEvent } from '../events';
import { refreshPlayerStats, xpToNextLevel } from '../hero';
import { Rng } from '../rng';
import { createTestRun, enterNextFloor, getPlayer, type RunState } from '../run';
import { resolvePlayerAction } from './TurnManager';

const WAIT: Action = { type: 'wait' };
const skill = (slot: 1 | 2 | 3 | 4 | 5 | 6): Action => ({ type: 'skill', slot });

/** Sala de teste só com o Knight em (7,5), as 4 skills liberadas e os goblins pedidos. */
function arena(goblins: { x: number; y: number }[], seed = 1): RunState {
  const state = createTestRun(seed);
  state.hero.skills = { brutalStrike: 1, berserk: 1, whirlwindThrow: 1, woundCleansing: 1 };
  getPlayer(state).pos = { x: 7, y: 5 };
  state.entities = [getPlayer(state), ...goblins.map((pos, i) => goblin(`g${i}`, pos))];
  return state;
}

function goblin(id: string, pos: { x: number; y: number }, hp = 15): Entity {
  const g = createEntity(id, ENTITY_TEMPLATES.goblinDummy, pos);
  g.hp = hp;
  g.maxHp = hp;
  g.homeRoom = 0;
  return g;
}

const attacksBy = (events: readonly CoreEvent[], id: string) =>
  events.filter((e): e is Extract<CoreEvent, { type: 'attacked' }> => e.type === 'attacked' && e.attackerId === id);

describe('Knight: estado inicial', () => {
  it('começa com Sword equipada (ATK 11), DEF 5 e 30 de mana', () => {
    const state = createTestRun(1);
    expect(getPlayer(state).atk).toBe(11);
    expect(getPlayer(state).def).toBe(5);
    expect(state.hero.equipment).toEqual({ weapon: 'sword' });
    expect(state.hero.mana).toBe(KNIGHT_START_MANA);
    expect(state.hero.level).toBe(1);
  });
});

describe('skills', () => {
  it('Brutal Strike: gasta 5 de mana e bate com ATK×2', () => {
    // ATK 11 × 2 = 22, contra o Goblin dummy de DEF 1 (× 20/21)
    const range = damageRange(22);
    const min = mitigate(range.min, 1);
    const max = mitigate(range.max, 1);
    for (let seed = 1; seed <= 30; seed++) {
      const state = arena([{ x: 8, y: 5 }], seed);
      state.entities[1]!.hp = 999;
      state.entities[1]!.maxHp = 999;
      const r = resolvePlayerAction(state, skill(1));
      expect(r.tookTurn).toBe(true);
      expect(r.events[0]).toEqual({ type: 'skill-used', entityId: 'player', skillId: 'brutalStrike' });
      const [hit] = attacksBy(r.events, 'player');
      expect(hit!.damage).toBeGreaterThanOrEqual(min);
      expect(hit!.damage).toBeLessThanOrEqual(max);
      expect(state.hero.mana).toBe(KNIGHT_START_MANA - 5);
    }
  });

  it('Brutal Strike prefere o inimigo na direção que o Knight olha', () => {
    const state = arena([{ x: 7, y: 4 }, { x: 6, y: 5 }]);
    state.hero.facing = 'W';
    const r = resolvePlayerAction(state, skill(1));
    expect(attacksBy(r.events, 'player')[0]!.targetId).toBe('g1');
  });

  it('sem alvo: não gasta mana nem turno', () => {
    const state = arena([{ x: 12, y: 5 }]);
    const r = resolvePlayerAction(state, skill(1));
    expect(r).toEqual({ tookTurn: false, reason: 'no-target', events: [] });
    expect(state.hero.mana).toBe(KNIGHT_START_MANA);
    expect(state.turn).toBe(0);
  });

  it('sem mana: não faz nada', () => {
    const state = arena([{ x: 8, y: 5 }]);
    state.hero.mana = 4;
    const r = resolvePlayerAction(state, skill(1));
    expect(r).toEqual({ tookTurn: false, reason: 'no-mana', events: [] });
    expect(state.hero.mana).toBe(4);
  });

  it('Berserk acerta os 4 adjacentes e só eles', () => {
    const state = arena([
      { x: 7, y: 4 },
      { x: 7, y: 6 },
      { x: 6, y: 5 },
      { x: 8, y: 5 },
      { x: 9, y: 5 },
    ]);
    const r = resolvePlayerAction(state, skill(2));
    const targets = attacksBy(r.events, 'player').map((a) => a.targetId);
    expect(targets.sort()).toEqual(['g0', 'g1', 'g2', 'g3']);
    expect(state.hero.mana).toBe(KNIGHT_START_MANA - 10);
  });

  it('Whirlwind Throw acerta a até 3 tiles em linha reta', () => {
    const state = arena([{ x: 10, y: 5 }]);
    const r = resolvePlayerAction(state, skill(3));
    expect(attacksBy(r.events, 'player')[0]!.targetId).toBe('g0');
    expect(state.hero.mana).toBe(KNIGHT_START_MANA - 8);
  });

  it('Whirlwind Throw não alcança a 4 tiles nem atravessa parede', () => {
    expect(resolvePlayerAction(arena([{ x: 11, y: 5 }]), skill(3)).tookTurn).toBe(false);
    const state = arena([{ x: 9, y: 5 }]);
    setTile(state.map, { x: 8, y: 5 }, TileType.WALL);
    expect(resolvePlayerAction(state, skill(3))).toMatchObject({ tookTurn: false, reason: 'no-target' });
  });

  it('Wound Cleansing cura 25% do HP max; com HP cheio não gasta nada', () => {
    const state = arena([]);
    expect(resolvePlayerAction(state, skill(4))).toMatchObject({ tookTurn: false, reason: 'full-hp' });
    getPlayer(state).hp = 20;
    const r = resolvePlayerAction(state, skill(4));
    expect(r.events).toContainEqual({ type: 'healed', entityId: 'player', amount: 13, hp: 33, source: 'skill' });
    expect(state.hero.mana).toBe(KNIGHT_START_MANA - 10);
  });

  it('toda skill de dano bate mais que o golpe básico', () => {
    for (const slot of [1, 3] as const) {
      const state = arena([{ x: 8, y: 5 }], 5);
      state.entities[1]!.hp = 999;
      const r = resolvePlayerAction(state, skill(slot));
      // ATK 11: básico rola até 14 (13 depois da DEF 1); ×1,5 começa em 12 e ×2 em 16
      expect(attacksBy(r.events, 'player')[0]!.damage).toBeGreaterThanOrEqual(slot === 1 ? 14 : 10);
    }
  });

  it('esperar não regenera mana (fim do exploit de cura)', () => {
    const state = arena([]);
    state.hero.mana = 10;
    for (let i = 0; i < 20; i++) resolvePlayerAction(state, WAIT);
    expect(state.hero.mana).toBe(10);
  });

  it(`kill rende +${MANA_PER_KILL} de mana, sem passar do máximo`, () => {
    const state = arena([{ x: 8, y: 5 }]);
    state.entities[1]!.hp = 1;
    state.hero.mana = 10;
    const r = resolvePlayerAction(state, { type: 'move', dir: 'E' });
    expect(r.events).toContainEqual({ type: 'mana-restored', amount: MANA_PER_KILL, mana: 10 + MANA_PER_KILL });

    const full = arena([{ x: 8, y: 5 }]);
    full.entities[1]!.hp = 1;
    resolvePlayerAction(full, { type: 'move', dir: 'E' });
    expect(full.hero.mana).toBe(full.hero.maxMana);
  });
});

describe('poções', () => {
  it('poção de HP cura 50% e sai do inventário', () => {
    const state = arena([]);
    state.hero.bag = ['hpPotion'];
    getPlayer(state).hp = 10;
    const r = resolvePlayerAction(state, skill(5));
    expect(r.events).toContainEqual({ type: 'healed', entityId: 'player', amount: 25, hp: 35, source: 'potion' });
    expect(state.hero.bag).toEqual([]);
  });

  it('poção de mana restaura 50% da mana max', () => {
    const state = arena([]);
    state.hero.bag = ['manaPotion'];
    state.hero.mana = 0;
    const r = resolvePlayerAction(state, skill(6));
    expect(r.events).toContainEqual({ type: 'mana-restored', amount: 15, mana: 15 });
  });

  it('sem poção, ou com HP/mana cheios, não gasta turno', () => {
    const state = arena([]);
    expect(resolvePlayerAction(state, skill(5))).toMatchObject({ tookTurn: false, reason: 'no-item' });
    state.hero.bag = ['hpPotion', 'manaPotion'];
    expect(resolvePlayerAction(state, skill(5))).toMatchObject({ tookTurn: false, reason: 'full-hp' });
    expect(resolvePlayerAction(state, skill(6))).toMatchObject({ tookTurn: false, reason: 'full-mana' });
    expect(state.hero.bag).toHaveLength(2);
  });
});

describe('recompensas de kill', () => {
  it('kill rende XP, gold ≥ 1 e a passiva de +2 HP', () => {
    const state = arena([{ x: 8, y: 5 }]);
    state.entities[1]!.hp = 1;
    getPlayer(state).hp = 30;
    const r = resolvePlayerAction(state, { type: 'move', dir: 'E' });
    const reward = r.events.find((e) => e.type === 'rewarded');
    expect(reward).toMatchObject({ type: 'rewarded', xp: 4 });
    if (reward?.type === 'rewarded') expect(reward.gold).toBeGreaterThanOrEqual(1);
    expect(state.hero.xp).toBe(4);
    expect(r.events).toContainEqual({ type: 'healed', entityId: 'player', amount: KILL_HEAL, hp: 32, source: 'passive' });
  });

  it('level up: +10 HP max e +10 mana max, e o XP que sobra continua', () => {
    const state = arena([{ x: 8, y: 5 }]);
    state.entities[1]!.hp = 1;
    state.hero.xp = xpToNextLevel(1) - 1; // 19: o kill de 4 XP sobe e sobra 3
    const r = resolvePlayerAction(state, { type: 'move', dir: 'E' });
    expect(r.events).toContainEqual({ type: 'leveled-up', level: 2 });
    expect(state.hero.level).toBe(2);
    expect(state.hero.xp).toBe(3);
    expect(getPlayer(state).maxHp).toBe(60);
    expect(state.hero.maxMana).toBe(40);
  });

  it('loot sai em vários seeds e é determinístico', () => {
    const lootFor = (seed: number) => {
      const state = arena([{ x: 8, y: 5 }], seed);
      state.entities[1]!.hp = 1;
      return resolvePlayerAction(state, { type: 'move', dir: 'E' }).events.filter((e) => e.type === 'looted');
    };
    const all = Array.from({ length: 200 }, (_, s) => lootFor(s + 1)).flat();
    expect(all.length).toBeGreaterThan(0);
    expect(lootFor(42)).toEqual(lootFor(42));
  });
});

describe('equipamento', () => {
  it('item melhor é vestido na hora e o antigo vai pro inventário', async () => {
    const { receiveItem } = await import('../items/Inventory');
    const state = createTestRun(1);
    const player = getPlayer(state);
    const events: CoreEvent[] = [];
    receiveItem(state.hero, player, 'spikeSword', events);
    expect(state.hero.equipment.weapon).toBe('spikeSword');
    expect(state.hero.bag).toEqual(['sword']);
    expect(player.atk).toBe(16);
    expect(events).toEqual([
      { type: 'looted', itemId: 'spikeSword', equipped: true },
      { type: 'stats-changed', atk: { from: 11, to: 16 }, def: { from: 5, to: 5 } },
    ]);

    // Pior ou igual: inventário
    receiveItem(state.hero, player, 'sword', events);
    expect(state.hero.equipment.weapon).toBe('spikeSword');
    expect(state.hero.bag).toEqual(['sword', 'sword']);

    // Slot vazio: qualquer armadura veste
    receiveItem(state.hero, player, 'leatherArmor', events);
    expect(player.def).toBe(7);
  });

  it('canEquip respeita a vocação ou ALL', async () => {
    const { canEquip } = await import('../items/Item');
    const staff = { kind: 'equipment', name: 'Staff', slot: 'weapon', atk: 5, def: 0, equipTags: ['SORCERER'], value: 1 } as const;
    expect(canEquip(staff, 'KNIGHT')).toBe(false);
    expect(canEquip({ ...staff, equipTags: ['ALL'] }, 'KNIGHT')).toBe(true);
    expect(canEquip({ kind: 'potion', name: 'x', effect: { type: 'heal', pct: 1 }, value: 1 }, 'KNIGHT')).toBe(false);
  });
});

describe('salas exploradas e Training Room', () => {
  it('sala vazia conta ao entrar; sala com monstro só depois que ele morre', () => {
    const empty = arena([]);
    const r = resolvePlayerAction(empty, WAIT);
    expect(r.events).toContainEqual({ type: 'room-cleared', explored: 1, trainingEarned: false });

    const busy = arena([{ x: 12, y: 9 }]);
    resolvePlayerAction(busy, WAIT);
    expect(busy.hero.roomsExplored).toBe(0);
    busy.entities[1]!.hp = 1;
    busy.entities[1]!.pos = { x: 8, y: 5 };
    resolvePlayerAction(busy, { type: 'move', dir: 'E' });
    expect(busy.hero.roomsExplored).toBe(1);
  });

  it(`a cada ${ROOMS_PER_TRAINING} salas, o próximo andar ganha uma Training Room`, () => {
    const state = arena([]);
    state.hero.roomsExplored = ROOMS_PER_TRAINING - 1;
    const r = resolvePlayerAction(state, WAIT);
    expect(r.events).toContainEqual({ type: 'room-cleared', explored: ROOMS_PER_TRAINING, trainingEarned: true });
    expect(state.hero.trainingPending).toBe(1);

    const hasTraining = enterNextFloor(state, Rng.fromSeed(3));
    expect(hasTraining).toBe(true);
    expect(state.hero.trainingPending).toBe(0);
    expect(state.map.tiles.filter((t) => t === TileType.TRAINING)).toHaveLength(1);
    // Training Room não tem monstro
    const i = state.map.tiles.indexOf(TileType.TRAINING);
    const center = { x: i % state.map.width, y: Math.floor(i / state.map.width) };
    const room = state.rooms.findIndex(
      (rm) => center.x >= rm.x && center.x < rm.x + rm.w && center.y >= rm.y && center.y < rm.y + rm.h,
    );
    expect(state.entities.some((e) => e.homeRoom === room)).toBe(false);
  });

  it('pisar na Training Room trava o turno até escolher; escolha dá +2 e é única', () => {
    const state = arena([]);
    setTile(state.map, { x: 8, y: 5 }, TileType.TRAINING);
    const r = resolvePlayerAction(state, { type: 'move', dir: 'E' });
    expect(r.events).toContainEqual({ type: 'training-offered' });
    expect(state.prompt).toEqual({ type: 'training' });

    expect(resolvePlayerAction(state, WAIT)).toMatchObject({ tookTurn: false, reason: 'awaiting-choice' });

    const turn = state.turn;
    const c = resolvePlayerAction(state, { type: 'choose', index: 1 });
    expect(c).toEqual({
      tookTurn: false,
      reason: 'free-action',
      events: [
        { type: 'trained', stat: 'def', amount: TRAINING_BONUS },
        { type: 'stats-changed', atk: { from: 11, to: 11 }, def: { from: 5, to: 5 + TRAINING_BONUS } },
      ],
    });
    expect(getPlayer(state).def).toBe(5 + TRAINING_BONUS);
    expect(state.turn).toBe(turn);
    expect(state.prompt).toBeNull();
    expect(getTile(state.map, { x: 8, y: 5 })).toBe(TileType.FLOOR);
  });

  it('treino soma com equipamento no ATK efetivo', () => {
    const state = createTestRun(1);
    state.hero.trainedAtk = 2;
    refreshPlayerStats(state.hero, getPlayer(state));
    expect(getPlayer(state).atk).toBe(13);
  });
});
