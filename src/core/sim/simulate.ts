import type { Action, SkillSlot } from '../actions';
import { damageRange } from '../combat/damage';
import { isWalkable, TileType } from '../dungeon/DungeonMap';
import type { CoreEvent } from '../events';
import { manhattan, pointKey, step, DIRECTIONS, type Point } from '../grid';
import { countInBag } from '../hero';
import { bfsFirstStep } from '../pathfinding';
import { createRun, getPlayer, livingEnemies, type RunState } from '../run';
import { resolvePlayerAction } from '../turn/TurnManager';

/**
 * Simulação headless de balanceamento: um bot joga runs inteiras e a gente
 * olha as médias. Não é um jogador bom — é uma régua fixa pra comparar
 * mudanças de número ("antes vencia 27%, agora 40%").
 *
 * Política do bot: poção de HP abaixo de 35%, cura abaixo de 50%, Berserk
 * com 2+ adjacentes, Brutal Strike quando o golpe básico não mata,
 * Whirlwind em quem vem chegando, caça monstro a até 8 tiles, senão escada.
 */
export interface RunReport {
  readonly seed: number;
  readonly won: boolean;
  readonly floor: number;
  readonly turns: number;
  readonly level: number;
  readonly atk: number;
  readonly def: number;
  readonly kills: number;
  readonly playerHits: number;
  readonly skillsUsed: number;
  readonly potionsUsed: number;
  readonly trainings: number;
  readonly damageTaken: number;
}

export function simulateRun(seed: number, maxTurns = 4000): RunReport {
  const state = createRun(seed);
  const r = { kills: 0, playerHits: 0, skillsUsed: 0, potionsUsed: 0, trainings: 0, damageTaken: 0 };
  const count = (events: readonly CoreEvent[]): void => {
    for (const e of events) {
      if (e.type === 'attacked' && e.attackerId === state.playerId) r.playerHits += 1;
      if (e.type === 'attacked' && e.targetId === state.playerId) r.damageTaken += e.damage;
      if (e.type === 'died' && e.entityId !== state.playerId) r.kills += 1;
      if (e.type === 'skill-used') r.skillsUsed += 1;
      if (e.type === 'healed' && e.source === 'potion') r.potionsUsed += 1;
      if (e.type === 'trained') r.trainings += 1;
    }
  };
  const act = (a: Action): boolean => {
    const res = resolvePlayerAction(state, a);
    count(res.events);
    return res.tookTurn || res.reason === 'free-action';
  };

  for (let t = 0; t < maxTurns && state.status === 'playing'; t++) {
    if (state.prompt === 'training') {
      act({ type: 'choose', index: r.trainings % 2 });
      continue;
    }
    botTurn(state, act);
  }

  const p = getPlayer(state);
  return {
    seed,
    won: state.status === 'won',
    floor: state.floor,
    turns: state.turn,
    level: state.hero.level,
    atk: p.atk,
    def: p.def,
    ...r,
  };
}

function botTurn(state: RunState, act: (a: Action) => boolean): void {
  const p = getPlayer(state);
  const { hero } = state;
  const skill = (slot: SkillSlot): boolean => act({ type: 'skill', slot });
  const enemies = livingEnemies(state);
  const adjacent = enemies.filter((e) => manhattan(e.pos, p.pos) === 1);

  if (p.hp < p.maxHp * 0.35 && countInBag(hero, 'hpPotion') > 0 && skill(5)) return;
  if (p.hp < p.maxHp * 0.5 && skill(4)) return;
  if (hero.mana < 10 && countInBag(hero, 'manaPotion') > 0 && skill(6)) return;
  if (adjacent.length >= 2 && skill(2)) return;

  const target = adjacent[0];
  if (target) {
    const basicMax = damageRange(p.atk).max - target.def;
    if (target.hp > basicMax && hero.mana >= 15 && skill(1)) return;
    const dir = DIRECTIONS.find((d) => pointKey(step(p.pos, d)) === pointKey(target.pos));
    if (dir && act({ type: 'move', dir })) return;
  }

  const inLine = enemies.find(
    (e) => (e.pos.x === p.pos.x || e.pos.y === p.pos.y) && manhattan(e.pos, p.pos) <= 3 && manhattan(e.pos, p.pos) > 1,
  );
  if (inLine && hero.mana >= 18 && skill(3)) return;

  const occupied = new Set(enemies.map((e) => pointKey(e.pos)));
  const hunt = enemies
    .filter((e) => manhattan(e.pos, p.pos) <= 8)
    .sort((a, b) => manhattan(a.pos, p.pos) - manhattan(b.pos, p.pos))[0];
  const passable = (q: Point): boolean => isWalkable(state.map, q) && !occupied.has(pointKey(q));
  // Sem caminho até o monstro (outro monstro no corredor): segue pra escada
  const dir =
    (hunt ? bfsFirstStep(p.pos, hunt.pos, passable) : null) ??
    bfsFirstStep(p.pos, stairsOf(state), passable) ??
    bfsFirstStep(p.pos, stairsOf(state), (q) => isWalkable(state.map, q));
  if (dir && act({ type: 'move', dir })) return;
  act({ type: 'wait' });
}

function stairsOf(state: RunState): Point {
  const i = state.map.tiles.indexOf(TileType.STAIRS);
  return { x: i % state.map.width, y: Math.floor(i / state.map.width) };
}

/** Resumo de várias runs, pra comparar mudanças de balanceamento. */
export function summarize(reports: readonly RunReport[]): Record<string, unknown> {
  const avg = (f: (r: RunReport) => number): number =>
    Math.round((reports.reduce((s, r) => s + f(r), 0) / reports.length) * 10) / 10;
  const deathsByFloor: Record<number, number> = {};
  for (const r of reports) if (!r.won) deathsByFloor[r.floor] = (deathsByFloor[r.floor] ?? 0) + 1;
  return {
    runs: reports.length,
    winRate: `${Math.round((reports.filter((r) => r.won).length / reports.length) * 100)}%`,
    deathsByFloor,
    avgTurns: avg((r) => r.turns),
    avgLevel: avg((r) => r.level),
    avgAtkEnd: avg((r) => r.atk),
    avgDefEnd: avg((r) => r.def),
    hitsPerKill: avg((r) => (r.kills ? r.playerHits / r.kills : 0)),
    skillsPerRun: avg((r) => r.skillsUsed),
    potionsPerRun: avg((r) => r.potionsUsed),
    trainingsPerRun: avg((r) => r.trainings),
  };
}
