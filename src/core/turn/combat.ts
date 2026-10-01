import { MIN_DAMAGE } from '../balance';
import { rollDamage } from '../combat/damage';
import { isAlive, type Entity } from '../entities/Entity';
import type { CoreEvent } from '../events';
import { isAdjacent4 } from '../grid';
import { cardTotal, healEntity } from '../hero';
import type { Rng } from '../rng';
import { getPlayer, type RunState } from '../run';
import { grantKillRewards } from './rewards';

/**
 * Um golpe. `multiplier` vem das skills (Brutal Strike ×2); o ataque básico
 * é ×1. Aplica as cartas do player:
 * - batendo: Golpe Crítico (dano ×2) e Vampirismo (cura parte do dano);
 * - apanhando: Pele de Ferro (−dano, mínimo 1) e Contra-ataque (revide).
 * Se o player mata, já recebe as recompensas.
 */
export function attack(
  state: RunState,
  attacker: Entity,
  target: Entity,
  multiplier: number,
  rng: Rng,
  events: CoreEvent[],
): void {
  const { hero } = state;
  const byPlayer = attacker.id === state.playerId;
  const onPlayer = target.id === state.playerId;

  let damage = rollDamage(Math.round(attacker.atk * multiplier), target.def, rng);
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
    return;
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
