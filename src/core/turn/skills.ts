import type { SkillSlot } from '../actions';
import { getItem, type ItemId } from '../data/items';
import { KNIGHT_HOTBAR, resolveSkill, type SkillId } from '../data/skills';
import { isWalkable } from '../dungeon/DungeonMap';
import type { Entity } from '../entities/Entity';
import type { CoreEvent } from '../events';
import { DIRECTIONS, neighbors4, step, type Direction } from '../grid';
import { healEntity } from '../hero';
import { takeFromBag } from '../items/Inventory';
import type { Rng } from '../rng';
import { entityAt, getPlayer, type RunState } from '../run';
import { attack } from './combat';

/** Por que uma skill/poção não saiu. Nada muda e o turno não passa. */
export type HotbarFailure =
  | 'not-a-turn-action'
  | 'skill-locked'
  | 'no-mana'
  | 'no-target'
  | 'full-hp'
  | 'full-mana'
  | 'no-item';

/** Usa o que estiver no slot da hotbar. true = gastou o turno. */
export function useHotbarSlot(
  state: RunState,
  slot: SkillSlot,
  rng: Rng,
  events: CoreEvent[],
): true | HotbarFailure {
  const entry = KNIGHT_HOTBAR[slot];
  if (!entry) return 'not-a-turn-action';
  return entry.type === 'skill' ? castSkill(state, entry.id, rng, events) : usePotion(state, entry.id, events);
}

/**
 * Lança uma skill. Valida tudo ANTES de mexer no estado: se falha
 * (sem mana, sem alvo, HP cheio), nada mudou.
 */
export function castSkill(state: RunState, id: SkillId, rng: Rng, events: CoreEvent[]): true | HotbarFailure {
  const { hero } = state;
  const level = hero.skills[id];
  if (!level) return 'skill-locked';
  const skill = resolveSkill(id, level);
  const player = getPlayer(state);
  if (hero.mana < skill.manaCost) return 'no-mana';

  let targets: Entity[] = [];
  switch (skill.kind) {
    case 'strike': {
      const t = adjacentEnemy(state, player, hero.facing);
      if (!t) return 'no-target';
      targets = [t];
      break;
    }
    case 'area':
      targets = neighbors4(player.pos)
        .map((p) => entityAt(state, p))
        .filter((e): e is Entity => e?.kind === 'enemy');
      if (targets.length === 0) return 'no-target';
      break;
    case 'ranged':
      targets = enemiesInLine(state, player, hero.facing, skill.range, skill.pierce);
      if (targets.length === 0) return 'no-target';
      break;
    case 'heal':
      if (player.hp >= player.maxHp) return 'full-hp';
      break;
  }

  hero.mana -= skill.manaCost;
  events.push({ type: 'skill-used', entityId: player.id, skillId: id });
  if (skill.kind === 'heal') {
    const amount = healEntity(player, Math.round(player.maxHp * skill.healPct));
    events.push({ type: 'healed', entityId: player.id, amount, hp: player.hp, source: 'skill' });
  } else {
    for (const t of targets) attack(state, player, t, skill.multiplier, rng, events);
  }
  return true;
}

export function usePotion(state: RunState, id: ItemId, events: CoreEvent[]): true | HotbarFailure {
  const item = getItem(id);
  const { hero } = state;
  const player = getPlayer(state);
  if (item.kind !== 'potion' || !hero.bag.includes(id)) return 'no-item';

  if (item.effect.type === 'heal') {
    if (player.hp >= player.maxHp) return 'full-hp';
    takeFromBag(hero, id);
    const amount = healEntity(player, Math.round(player.maxHp * item.effect.pct));
    events.push({ type: 'healed', entityId: player.id, amount, hp: player.hp, source: 'potion' });
  } else {
    if (hero.mana >= hero.maxMana) return 'full-mana';
    takeFromBag(hero, id);
    const before = hero.mana;
    hero.mana = Math.min(hero.maxMana, hero.mana + Math.round(hero.maxMana * item.effect.pct));
    events.push({ type: 'mana-restored', amount: hero.mana - before, mana: hero.mana });
  }
  return true;
}

/** Direção que o player olha primeiro, depois as outras na ordem fixa N, S, E, W. */
function directionsFrom(facing: Direction): Direction[] {
  return [facing, ...DIRECTIONS.filter((d) => d !== facing)];
}

function adjacentEnemy(state: RunState, from: Entity, facing: Direction): Entity | undefined {
  for (const dir of directionsFrom(facing)) {
    const e = entityAt(state, step(from.pos, dir));
    if (e?.kind === 'enemy') return e;
  }
  return undefined;
}

/**
 * Inimigos em linha reta até `range`, na primeira direção que tiver algum
 * (a que o player olha primeiro). Parede sempre bloqueia. Sem `pierce`, só
 * o primeiro da linha; com `pierce`, todos até a parede ou o alcance.
 */
function enemiesInLine(state: RunState, from: Entity, facing: Direction, range: number, pierce: boolean): Entity[] {
  for (const dir of directionsFrom(facing)) {
    const hits: Entity[] = [];
    let p = from.pos;
    for (let i = 0; i < range; i++) {
      p = step(p, dir);
      if (!isWalkable(state.map, p)) break;
      const e = entityAt(state, p);
      if (!e) continue;
      if (e.kind !== 'enemy') break;
      hits.push(e);
      if (!pierce) break;
    }
    if (hits.length > 0) return hits;
  }
  return [];
}
