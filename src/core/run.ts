import { ENTITY_TEMPLATES } from './data/entities';
import { generateFloor } from './dungeon/DungeonGenerator';
import { createTestRoom, setTile, TileType, type DungeonMap } from './dungeon/DungeonMap';
import { spawnBoss, spawnEnemies } from './dungeon/populate';
import { FINAL_FLOOR, MERCHANT_FLOORS } from './balance';
import { roomCenter, roomIndexAt, type Room } from './dungeon/Room';
import { createEntity, isAlive, type Entity } from './entities/Entity';
import { samePoint, type Point } from './grid';
import { createKnightHero, refreshPlayerStats, type HeroState } from './hero';
import { revealAround, revealStairsIfWatcher } from './fog';
import { rollMerchant, type MerchantState } from './shop';
import { Rng, type RngState } from './rng';
import { openCardPromptIfPending } from './cards';
import { NO_BONUSES, type RunBonuses } from './meta/metaProgress';

export type RunStatus = 'playing' | 'won' | 'lost';

import type { CardId } from './data/cards';

/**
 * Versão do formato do RunState (e do save da run).
 * 2: andares (Marco 2a). 3: herói, salas exploradas e prompt (Marco 2b).
 * 4: cartas e skills por nível; prompt vira objeto (Marco 2d).
 * 5: fog of war, tiles explorados do andar (Marco 3).
 * 6: relíquias, mercador, escada escondida do boss, habilidades de monstro (Marco 4).
 * 7: bônus da meta no herói e estatísticas da run (kills por monstro) (Marco 5).
 */
export const RUN_STATE_VERSION = 7;

/** Números da run pro resumo do fim e pro bestiário (Marco 5). */
export interface RunStats {
  /** Kills do player por nome do monstro (invocados do boss contam como Orc). */
  kills: Record<string, number>;
}

/** Escolha pendente que trava o turno até o player responder. */
export type RunPrompt =
  | { readonly type: 'training' }
  | { readonly type: 'card'; readonly offer: readonly CardId[] }
  /** Loja do mercador aberta (Marco 4). */
  | { readonly type: 'shop' };

/**
 * Estado completo da run. JSON puro: JSON.stringify/parse e continua
 * exatamente de onde parou (inclusive a sequência de sorteios).
 */
export interface RunState {
  readonly version: typeof RUN_STATE_VERSION;
  readonly seed: number;
  rngState: RngState;
  turn: number;
  status: RunStatus;
  /** Andar atual, começando em 1. */
  floor: number;
  map: DungeonMap;
  rooms: Room[];
  /** Salas do andar em que o player já entrou / que já contaram como exploradas. */
  visitedRooms: number[];
  clearedRooms: number[];
  /** Fog of war: tiles do andar já vistos (índice y * width + x, ordenado). */
  explored: number[];
  /** Mercador do andar (estoque), ou null se o andar não tem. */
  merchant: MerchantState | null;
  /**
   * Andar do boss: onde o boss nasceu (e a escada estaria). Enquanto não é
   * null, não há escada no mapa; ela aparece onde o boss morrer.
   */
  hiddenStairs: Point | null;
  entities: Entity[];
  readonly playerId: string;
  hero: HeroState;
  prompt: RunPrompt | null;
  runStats: RunStats;
}

/** Knight novo com o equipamento inicial já somado no ATK/DEF. */
function createKnight(pos: Point, bonuses: RunBonuses = NO_BONUSES): { knight: Entity; hero: HeroState } {
  const knight = createEntity('player', ENTITY_TEMPLATES.knight, pos);
  knight.maxHp += bonuses.maxHp;
  knight.hp = knight.maxHp;
  const hero = createKnightHero(bonuses);
  refreshPlayerStats(hero, knight);
  return { knight, hero };
}

/**
 * Run nova: andar 1 gerado pelo BSP a partir do seed. `bonuses` = upgrades do
 * Sanctum. O mapa e os monstros não dependem deles (mesmo seed, mesmo andar 1);
 * a carta inicial do Tome sorteia depois, com o mesmo Rng.
 */
export function createRun(seed: number, bonuses: RunBonuses = NO_BONUSES): RunState {
  const rng = Rng.fromSeed(seed);
  const floor = generateFloor(rng);
  const { knight, hero } = createKnight(floor.start, bonuses);
  const enemies = spawnEnemies(1, floor, rng);
  const state: RunState = {
    version: RUN_STATE_VERSION,
    seed,
    rngState: rng.getState(),
    turn: 0,
    status: 'playing',
    floor: 1,
    map: floor.map,
    rooms: floor.rooms,
    visitedRooms: [],
    clearedRooms: [],
    explored: [],
    merchant: null,
    hiddenStairs: null,
    entities: [knight, ...enemies],
    playerId: knight.id,
    hero,
    prompt: null,
    runStats: { kills: {} },
  };
  revealAround(state);
  if (bonuses.startingCard) {
    // Tome "Saber" 2: a run já começa com uma escolha de carta aberta
    hero.pendingCardPicks += 1;
    openCardPromptIfPending(state, rng, []);
    state.rngState = rng.getState();
  }
  return state;
}

/**
 * Troca pro próximo andar: mapa e monstros novos, o player mantém o que tem.
 * Salas especiais (nunca a inicial nem a da escada, sem monstros):
 * - Training Room, se há uma pendente: tile TRAINING no centro.
 * - Mercador (MERCHANT_FLOORS): tile MERCHANT no centro e estoque sorteado.
 * - Andar final: o Orc Warlord fica onde seria a escada; ela aparece onde
 *   ele morrer. A sala dele não tem outros monstros.
 * Usa o Rng da run (quem chama salva o estado dele depois).
 * Devolve se o andar novo tem Training Room.
 */
export function enterNextFloor(state: RunState, rng: Rng): boolean {
  const player = getPlayer(state);
  const next = state.floor + 1;
  const floor = generateFloor(rng);
  const stairsRoom = roomIndexAt(floor.rooms, floor.stairs);
  const special: number[] = [];
  const freeRooms = (): number[] =>
    floor.rooms.map((_, i) => i).filter((i) => i !== floor.startRoom && i !== stairsRoom && !special.includes(i));

  let trainingRoom = -1;
  if (state.hero.trainingPending > 0) {
    const candidates = freeRooms();
    if (candidates.length > 0) {
      trainingRoom = rng.pick(candidates);
      special.push(trainingRoom);
      setTile(floor.map, roomCenter(floor.rooms[trainingRoom] as Room), TileType.TRAINING);
      state.hero.trainingPending -= 1;
    }
  }

  state.merchant = null;
  if (MERCHANT_FLOORS.includes(next)) {
    const candidates = freeRooms();
    if (candidates.length > 0) {
      const merchantRoom = rng.pick(candidates);
      special.push(merchantRoom);
      setTile(floor.map, roomCenter(floor.rooms[merchantRoom] as Room), TileType.MERCHANT);
      state.merchant = rollMerchant(next, state.hero, rng);
    }
  }

  const bosses: Entity[] = [];
  state.hiddenStairs = null;
  if (next === FINAL_FLOOR && stairsRoom >= 0) {
    setTile(floor.map, floor.stairs, TileType.FLOOR);
    state.hiddenStairs = { ...floor.stairs };
    special.push(stairsRoom);
    bosses.push(spawnBoss(next, floor.stairs, stairsRoom));
  }

  player.pos = { ...floor.start };
  state.floor = next;
  state.map = floor.map;
  state.rooms = floor.rooms;
  state.visitedRooms = [];
  state.clearedRooms = [];
  state.explored = [];
  state.entities = [player, ...bosses, ...spawnEnemies(next, floor, rng, special)];
  revealAround(state);
  revealStairsIfWatcher(state);
  return trainingRoom >= 0;
}

export const TEST_ROOM = { width: 15, height: 11 } as const;

/** Testes: sala fixa 15×11 com o Knight à esquerda e um Goblin à direita. */
export function createTestRun(seed: number): RunState {
  const { knight, hero } = createKnight({ x: 3, y: 5 });
  const goblin = createEntity('goblin-1', ENTITY_TEMPLATES.goblinDummy, { x: 11, y: 5 });
  goblin.homeRoom = 0;
  const state: RunState = {
    version: RUN_STATE_VERSION,
    seed,
    rngState: Rng.fromSeed(seed).getState(),
    turn: 0,
    status: 'playing',
    floor: 1,
    map: createTestRoom(TEST_ROOM.width, TEST_ROOM.height),
    rooms: [{ x: 1, y: 1, w: TEST_ROOM.width - 2, h: TEST_ROOM.height - 2 }],
    visitedRooms: [],
    clearedRooms: [],
    explored: [],
    merchant: null,
    hiddenStairs: null,
    entities: [knight, goblin],
    playerId: knight.id,
    hero,
    prompt: null,
    runStats: { kills: {} },
  };
  revealAround(state);
  return state;
}

export function getPlayer(state: RunState): Entity {
  const p = state.entities.find((e) => e.id === state.playerId);
  if (!p) throw new Error('RunState sem player');
  return p;
}

export function getEntity(state: RunState, id: string): Entity | undefined {
  return state.entities.find((e) => e.id === id);
}

/** Entidade VIVA no tile (mortas não ocupam espaço). */
export function entityAt(state: RunState, p: Point): Entity | undefined {
  return state.entities.find((e) => isAlive(e) && samePoint(e.pos, p));
}

export function livingEnemies(state: RunState): Entity[] {
  return state.entities.filter((e) => e.kind === 'enemy' && isAlive(e));
}
