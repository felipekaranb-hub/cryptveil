import { describe, expect, it } from 'vitest';
import { FINAL_FLOOR, FLOOR_SPAWNS } from './balance';
import { ENTITY_TEMPLATES } from './data/entities';
import { getTile, TileType } from './dungeon/DungeonMap';
import { rollMonster } from './dungeon/populate';
import { createEntity, type Entity } from './entities/Entity';
import type { CoreEvent } from './events';
import { Rng } from './rng';
import { createRun, createTestRun, enterNextFloor, getPlayer, livingEnemies, type RunState } from './run';
import { resolvePlayerAction } from './turn/TurnManager';

const WAIT = { type: 'wait' } as const;

/** Sala de teste com o Knight em (3,5) e os monstros pedidos. */
function arena(monsters: Entity[], seed = 1): RunState {
  const state = createTestRun(seed);
  getPlayer(state).pos = { x: 3, y: 5 };
  state.entities = [getPlayer(state), ...monsters];
  return state;
}

function monster(id: string, template: keyof typeof ENTITY_TEMPLATES, x: number, y: number): Entity {
  const m = createEntity(id, ENTITY_TEMPLATES[template], { x, y });
  m.homeRoom = 0;
  return m;
}

const ofType = <T extends CoreEvent['type']>(events: readonly CoreEvent[], type: T) =>
  events.filter((e): e is Extract<CoreEvent, { type: T }> => e.type === type);

describe('monstros por andar', () => {
  it('o sorteio só tira monstros do peso do andar', () => {
    for (let floor = 1; floor <= FINAL_FLOOR; floor++) {
      const allowed = Object.keys(FLOOR_SPAWNS[floor]!.weights);
      const rng = Rng.fromSeed(floor);
      for (let i = 0; i < 200; i++) expect(allowed).toContain(rollMonster(floor, rng));
    }
  });

  it('andares mais fundos têm salas mais povoadas e monstros mais fortes', () => {
    const avg = (floor: number): { count: number; atk: number } => {
      let count = 0;
      let atk = 0;
      let n = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const state = createRun(seed);
        while (state.floor < floor) enterNextFloor(state, Rng.fromState(state.rngState));
        const enemies = livingEnemies(state).filter((e) => !e.boss);
        count += enemies.length;
        atk += enemies.reduce((s, e) => s + e.atk, 0);
        n += enemies.length;
      }
      return { count: count / 30, atk: atk / n };
    };
    const f1 = avg(1);
    const f4 = avg(4);
    expect(f4.count).toBeGreaterThan(f1.count);
    expect(f4.atk).toBeGreaterThan(f1.atk * 1.5);
  });
});

describe('ataque de longe (Goblin, Orc, Orc Warlord)', () => {
  it('Goblin em linha arremessa pedra (mais fraco), entra em recarga e volta a avançar', () => {
    const state = arena([monster('g', 'goblin', 6, 5)]);
    const first = resolvePlayerAction(state, WAIT);
    const [hit] = ofType(first.events, 'attacked');
    expect(hit?.ranged).toEqual({ projectile: 'uma pedra' });
    expect(state.entities[1]!.rangedCooldown).toBe(ENTITY_TEMPLATES.goblin.ranged.cooldown);

    const second = resolvePlayerAction(state, WAIT);
    expect(ofType(second.events, 'attacked')).toHaveLength(0);
    expect(ofType(second.events, 'moved')).toHaveLength(1); // na recarga, avança
  });

  it('não arremessa através de parede nem de outro monstro, e Rat nunca arremessa', () => {
    const blocked = arena([monster('r', 'rat', 4, 5), monster('g', 'goblin', 6, 5)]);
    const r = resolvePlayerAction(blocked, WAIT);
    expect(ofType(r.events, 'attacked').every((a) => !a.ranged)).toBe(true);
    expect(ofType(r.events, 'attacked').filter((a) => a.attackerId === 'g')).toHaveLength(0);
  });

  it('encostado, bate corpo a corpo', () => {
    const state = arena([monster('o', 'orc', 4, 5)]);
    const [hit] = ofType(resolvePlayerAction(state, WAIT).events, 'attacked');
    expect(hit?.attackerId).toBe('o');
    expect(hit?.ranged).toBeUndefined();
  });
});

describe('Orc Warlord', () => {
  it('invoca 1 Orc a cada 3 turnos com o player perto, no máximo 3 vivos', () => {
    const boss = monster('boss', 'orcWarlord', 10, 5);
    const state = arena([boss]);
    getPlayer(state).hp = getPlayer(state).maxHp = 999999;
    let summons = 0;
    for (let t = 0; t < 30; t++) summons += ofType(resolvePlayerAction(state, WAIT).events, 'summoned').length;
    expect(summons).toBe(3);
    expect(state.entities.filter((e) => e.summoned).every((e) => e.name === 'Orc')).toBe(true);
  });

  it('abaixo de 30% do HP enfurece uma vez e bate ×1,5', () => {
    const boss = monster('boss', 'orcWarlord', 4, 5);
    const state = arena([boss]);
    getPlayer(state).atk = 200;
    boss.hp = 160; // 32%
    const r = resolvePlayerAction(state, { type: 'move', dir: 'E' });
    expect(ofType(r.events, 'enraged')).toEqual([{ type: 'enraged', entityId: 'boss' }]);
    expect(boss.enraged).toBe(true);
  });

  it('kill de Orc invocado rende só metade do XP: sem gold, loot, mana nem cura', () => {
    const orc = monster('s', 'orc', 4, 5);
    orc.summoned = true;
    orc.hp = 1;
    const state = arena([orc]);
    state.hero.mana = 0;
    getPlayer(state).hp = 10;
    const gold = state.hero.gold;
    const r = resolvePlayerAction(state, { type: 'move', dir: 'E' });
    expect(ofType(r.events, 'rewarded')).toEqual([
      { type: 'rewarded', xp: Math.floor(ENTITY_TEMPLATES.orc.reward.xp / 2), gold: 0 },
    ]);
    expect(state.hero.gold).toBe(gold);
    expect(state.hero.mana).toBe(0);
    expect(ofType(r.events, 'looted')).toHaveLength(0);
    expect(ofType(r.events, 'healed').filter((h) => h.source === 'passive')).toHaveLength(0);
  });

  it(`andar ${FINAL_FLOOR}: o boss nasce no lugar da escada, sozinho na sala; a escada só aparece quando ele morre`, () => {
    const state = createRun(5);
    while (state.floor < FINAL_FLOOR) enterNextFloor(state, Rng.fromState(state.rngState));
    const boss = state.entities.find((e) => e.boss)!;
    expect(state.hiddenStairs).toEqual(boss.pos);
    expect(state.map.tiles.includes(TileType.STAIRS)).toBe(false);
    expect(state.entities.filter((e) => e.homeRoom === boss.homeRoom)).toEqual([boss]);

    // Mata o boss num golpe
    const player = getPlayer(state);
    const at = state.hiddenStairs!;
    player.pos = { x: at.x - 1, y: at.y };
    player.atk = 99999;
    if (getTile(state.map, player.pos) === TileType.WALL) player.pos = { x: at.x + 1, y: at.y };
    const dir = player.pos.x < at.x ? 'E' : 'W';
    const r = resolvePlayerAction(state, { type: 'move', dir });
    // A escada aparece onde ele caiu (aqui, o lugar onde nasceu)
    expect(ofType(r.events, 'stairs-revealed')).toEqual([{ type: 'stairs-revealed', at }]);
    expect(getTile(state.map, at)).toBe(TileType.STAIRS);
    expect(state.hiddenStairs).toBeNull();
    // Drop do boss: sempre Tower Shield e uma entre Crown Helmet / Magic Sword
    const loot = ofType(r.events, 'looted').map((l) => l.itemId);
    expect(loot).toContain('towerShield');
    expect(loot.some((id) => id === 'crownHelmet' || id === 'magicSword')).toBe(true);
  });
});

describe('escada do boss', () => {
  it('aparece onde o boss caiu, mesmo que o Knight esteja em cima do lugar original', () => {
    const state = createRun(5);
    while (state.floor < FINAL_FLOOR) enterNextFloor(state, Rng.fromState(state.rngState));
    const boss = state.entities.find((e) => e.boss)!;
    const player = getPlayer(state);
    const original = { ...state.hiddenStairs! };
    // Knight no lugar original da escada, boss encostado a leste (ou oeste)
    player.pos = original;
    player.atk = 99999;
    const east = { x: original.x + 1, y: original.y };
    boss.pos = getTile(state.map, east) !== TileType.WALL ? east : { x: original.x - 1, y: original.y };
    const r = resolvePlayerAction(state, { type: 'move', dir: boss.pos.x > original.x ? 'E' : 'W' });
    const [revealed] = ofType(r.events, 'stairs-revealed');
    expect(revealed?.at).toEqual(boss.pos);
    expect(getTile(state.map, original)).not.toBe(TileType.STAIRS);
    // Os 60 de XP do boss sobem de nível: escolhe as cartas e dá um passo pra vencer
    while (state.prompt) resolvePlayerAction(state, { type: 'choose', index: 0 });
    const win = resolvePlayerAction(state, { type: 'move', dir: boss.pos.x > original.x ? 'E' : 'W' });
    expect(ofType(win.events, 'victory')).toHaveLength(1);
  });
});
