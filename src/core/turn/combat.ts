import { MIN_DAMAGE } from '../balance';
import { rollDamage } from '../combat/damage';
import { isAlive, type Entity } from '../entities/Entity';
import type { CoreEvent } from '../events';
import { isAdjacent4 } from '../grid';
import { cardTotal, healEntity, relicEffect } from '../hero';
import { setTile, TileType } from '../dungeon/DungeonMap';
import type { Rng } from '../rng';
import { getPlayer, type RunState } from '../run';
import { grantKillRewards } from './rewards';

/**
 * Um golpe. `multiplier` vem das skills (Brutal Strike ×2); o ataque básico
 * é ×1. Aplica as cartas do player:
 * - batendo: Golpe Crítico (dano ×2) e Vampirismo (cura parte do dano);
 * - apanhando: Pele de Ferro (−dano, mínimo 1) e Contra-ataque (revide).
 * Marco 4: relíquia Totem de Guerra (1º golpe em cada monstro ×2), fúria do
 * boss (dano ×1,5 abaixo de 30% do HP) e arremesso de longe (`ranged`).
 * Se o player mata, já recebe as recompensas; boss morto revela a escada.
 */
export function attack(
  state: RunState,
  attacker: Entity,
  target: Entity,
  multiplier: number,
  rng: Rng,
  events: CoreEvent[],
  ranged?: { readonly projectile: string },
): void {
  const { hero } = state;
  const byPlayer = attacker.id === state.playerId;
  const onPlayer = target.id === state.playerId;

  let mult = multiplier;
  if (attacker.enraged && attacker.enrage) mult *= attacker.enrage.multiplier;
  if (byPlayer && !target.struck) {
    mult *= relicEffect(hero, 'first-strike')?.multiplier ?? 1;
    target.struck = true;
  }

  let damage = rollDamage(Math.round(attacker.atk * mult), target.def, rng);
  let critical = false;
  if (byPlayer) {
    const critChance = cardTotal(hero, 'critical', (e) => e.chance);
    if (critChance > 0 && rng.chance(critChance)) {
      critical = true;
      damage *= 2;
    }
  }
  if (onPlayer) damage = Math.max(MIN_DAMAGE, damage - cardTotal(hero, 'iron-skin', (e) => e.reduction));

  target.hp = Math.max(0, target.hp - damage);
  events.push({
    type: 'attacked',
    attackerId: attacker.id,
    targetId: target.id,
    damage,
    targetHp: target.hp,
    critical,
    ...(ranged ? { ranged } : {}),
  });

  if (byPlayer) {
    const lifesteal = Math.round(damage * cardTotal(hero, 'vampirism', (e) => e.pct));
    const healed = lifesteal > 0 ? healEntity(attacker, lifesteal) : 0;
    if (healed > 0) {
      events.push({ type: 'healed', entityId: attacker.id, amount: healed, hp: attacker.hp, source: 'vampirism' });
    }
  }

  if (target.hp === 0) {
    events.push({ type: 'died', entityId: target.id });
    if (byPlayer) grantKillRewards(state, target, rng, events);
    // A escada aparece onde o boss caiu: nunca debaixo do Knight (que teria
    // de sair e voltar pra descer) e sempre perto dele
    if (target.boss && state.hiddenStairs) {
      const at = { ...target.pos };
      setTile(state.map, at, TileType.STAIRS);
      events.push({ type: 'stairs-revealed', at });
      state.hiddenStairs = null;
    }
    return;
  }

  // Boss abaixo do limite: enfurece uma vez
  if (target.enrage && !target.enraged && target.hp < target.maxHp * target.enrage.below) {
    target.enraged = true;
    events.push({ type: 'enraged', entityId: target.id });
  }

  // Contra-ataque: revide com golpe básico (o revide não gera outro revide)
  if (onPlayer && isAlive(attacker) && isAdjacent4(attacker.pos, target.pos)) {
    const chance = cardTotal(hero, 'counter', (e) => e.chance);
    if (chance > 0 && rng.chance(chance)) {
      events.push({ type: 'countered', entityId: target.id });
      attack(state, getPlayer(state), attacker, 1, rng, events);
    }
  }
}
