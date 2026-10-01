import { describe, expect, it } from 'vitest';
import { MERCHANT_FLOORS, SHOP } from './balance';
import { ITEMS } from './data/items';
import { RELICS } from './data/relics';
import { getTile, setTile, TileType } from './dungeon/DungeonMap';
import { createEntity } from './entities/Entity';
import { ENTITY_TEMPLATES } from './data/entities';
import { buyPrice, sellPrice, shopOffers } from './shop';
import { Rng } from './rng';
import { createRun, createTestRun, enterNextFloor, getPlayer, type RunState } from './run';
import { resolvePlayerAction } from './turn/TurnManager';

/** Sala de teste com mercador a leste do Knight (sem monstros). */
function shopRun(): RunState {
  const state = createTestRun(1);
  state.entities = [getPlayer(state)];
  setTile(state.map, { x: 4, y: 5 }, TileType.MERCHANT);
  state.merchant = { stock: ['spikeSword', 'chainArmor'], relic: 'goldenIdol' };
  state.hero.gold = 500;
  return state;
}

function openShop(state: RunState): void {
  const r = resolvePlayerAction(state, { type: 'move', dir: 'E' });
  expect(r.events).toContainEqual({ type: 'shop-opened' });
}

describe('preços', () => {
  it('compra 100% e venda 30%; item da vocação +10% nas duas; mínimo 1', () => {
    expect(buyPrice(ITEMS.hpPotion, 'KNIGHT')).toBe(ITEMS.hpPotion.value);
    expect(buyPrice(ITEMS.spikeSword, 'KNIGHT')).toBe(Math.round(ITEMS.spikeSword.value * 1.1));
    expect(buyPrice(ITEMS.leatherArmor, 'KNIGHT')).toBe(ITEMS.leatherArmor.value); // 'ALL' não é da vocação
    expect(sellPrice(ITEMS.bone, 'KNIGHT')).toBe(Math.round(ITEMS.bone.value * SHOP.sellRate));
    expect(sellPrice(ITEMS.spikeSword, 'KNIGHT')).toBe(Math.round(ITEMS.spikeSword.value * SHOP.sellRate * 1.1));
    expect(sellPrice(ITEMS.cheese, 'KNIGHT')).toBeGreaterThanOrEqual(1);
  });
});

describe('mercador', () => {
  it(`aparece nos andares ${MERCHANT_FLOORS.join(', ')}, numa sala sem monstros`, () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = createRun(seed);
      expect(state.merchant).toBeNull();
      while (state.floor < 5) {
        enterNextFloor(state, Rng.fromState(state.rngState));
        const i = state.map.tiles.indexOf(TileType.MERCHANT);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(state.merchant!.stock).toHaveLength(SHOP.equipmentStock);
        const p = { x: i % state.map.width, y: Math.floor(i / state.map.width) };
        const room = state.rooms.findIndex((r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h);
        expect(state.entities.some((e) => e.kind === 'enemy' && e.homeRoom === room)).toBe(false);
      }
    }
  });

  it('pisar abre a loja; comprar e vender não gastam turno; Esc fecha', () => {
    const state = shopRun();
    openShop(state);
    expect(state.prompt).toEqual({ type: 'shop' });
    const turn = state.turn;

    const offers = shopOffers(state);
    const sword = offers.findIndex((o) => o.kind === 'item' && o.itemId === 'spikeSword');
    const r = resolvePlayerAction(state, { type: 'buy', index: sword });
    expect(r).toMatchObject({ tookTurn: false, reason: 'free-action' });
    expect(state.hero.equipment.weapon).toBe('spikeSword'); // melhor: auto-equip
    expect(state.merchant!.stock).toEqual(['chainArmor']);
    expect(state.hero.gold).toBe(500 - buyPrice(ITEMS.spikeSword, 'KNIGHT'));

    const gold = state.hero.gold;
    resolvePlayerAction(state, { type: 'sell', itemId: 'sword' });
    expect(state.hero.gold).toBe(gold + sellPrice(ITEMS.sword, 'KNIGHT'));
    expect(state.hero.bag).not.toContain('sword');

    // Andar não passa com a loja aberta
    expect(resolvePlayerAction(state, { type: 'move', dir: 'E' })).toMatchObject({ reason: 'awaiting-choice' });
    resolvePlayerAction(state, { type: 'cancel' });
    expect(state.prompt).toBeNull();
    expect(state.turn).toBe(turn);
  });

  it('poção é ilimitada; sem gold não compra; relíquia sai do estoque e ocupa slot', () => {
    const state = shopRun();
    openShop(state);
    const potion = 0;
    for (let i = 0; i < 3; i++) resolvePlayerAction(state, { type: 'buy', index: potion });
    expect(state.hero.bag.filter((b) => b === 'hpPotion')).toHaveLength(3);

    const relic = shopOffers(state).findIndex((o) => o.kind === 'relic');
    resolvePlayerAction(state, { type: 'buy', index: relic });
    expect(state.hero.relics).toEqual(['goldenIdol']);
    expect(state.merchant!.relic).toBeNull();

    state.hero.gold = 0;
    expect(resolvePlayerAction(state, { type: 'buy', index: potion })).toMatchObject({ reason: 'no-gold' });
  });

  it('o mercador não oferece relíquia que o player já tem', () => {
    const state = createRun(3);
    state.hero.relics = ['goldenIdol', 'watcherEye', 'bloodStone'];
    for (let i = 0; i < 20; i++) {
      enterNextFloor(state, Rng.fromState(state.rngState));
      expect([null, 'warTotem']).toContain(state.merchant?.relic ?? null);
      state.floor = 1;
    }
  });
});

describe('relíquias', () => {
  function killOne(state: RunState, hp = 1): ReturnType<typeof resolvePlayerAction> {
    const rat = createEntity('r', ENTITY_TEMPLATES.rat, { x: 4, y: 5 });
    rat.hp = hp;
    rat.homeRoom = 0;
    state.entities = [getPlayer(state), rat];
    getPlayer(state).pos = { x: 3, y: 5 };
    return resolvePlayerAction(state, { type: 'move', dir: 'E' });
  }

  it('Ídolo Dourado: +50% de gold por kill', () => {
    const plain = killOne(createTestRun(9));
    const withIdol = createTestRun(9);
    withIdol.hero.relics = ['goldenIdol'];
    const idol = killOne(withIdol);
    const gold = (r: typeof plain) => r.events.find((e) => e.type === 'rewarded')!;
    expect((gold(idol) as { gold: number }).gold).toBe(Math.ceil((gold(plain) as { gold: number }).gold * 1.5));
  });

  it('Pedra de Sangue: kill cura 5% do HP max além da passiva', () => {
    const state = createTestRun(2);
    state.hero.relics = ['bloodStone'];
    const p = getPlayer(state);
    p.maxHp = 200;
    p.hp = 100;
    killOne(state);
    expect(p.hp).toBe(100 + 2 + 10);
  });

  it('Totem de Guerra: o primeiro golpe em cada monstro dá dano ×2', () => {
    const hit = (relic: boolean): number => {
      const state = createTestRun(4);
      if (relic) state.hero.relics = ['warTotem'];
      const r = killOne(state, 9999);
      return (r.events.find((e) => e.type === 'attacked') as { damage: number }).damage;
    };
    expect(hit(true)).toBeGreaterThan(hit(false));
  });

  it('Olho do Vigia: visão maior no corredor e escada já explorada ao chegar no andar', () => {
    const state = createRun(8);
    state.hero.relics = ['watcherEye'];
    enterNextFloor(state, Rng.fromState(state.rngState));
    const i = state.map.tiles.indexOf(TileType.STAIRS);
    expect(state.explored).toContain(i);
    expect(RELICS.watcherEye.effect.vision).toBeGreaterThan(2);
    expect(getTile(state.map, getPlayer(state).pos)).not.toBe(TileType.WALL);
  });
});
