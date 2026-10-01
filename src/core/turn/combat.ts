import { rollDamage } from '../combat/damage';
import type { Entity } from '../entities/Entity';
import type { CoreEvent } from '../events';
import type { Rng } from '../rng';
import type { RunState } from '../run';
import { grantKillRewards } from './rewards';

/**
 * Um golpe. `multiplier` vem das skills (Brutal Strike ×1,5); o ataque
 * básico é ×1. Se o player mata, já recebe as recompensas.
 */
export function attack(
  state: RunState,
  attacker: Entity,
  target: Entity,
  multiplier: number,
  rng: Rng,
  events: CoreEvent[],
): void {
  const damage = rollDamage(Math.round(attacker.atk * multiplier), target.def, rng);
  target.hp = Math.max(0, target.hp - damage);
  events.push({
    type: 'attacked',
    attackerId: attacker.id,
    targetId: target.id,
    damage,
    targetHp: target.hp,
  });
  if (target.hp === 0) {
    events.push({ type: 'died', entityId: target.id });
    if (attacker.id === state.playerId) grantKillRewards(state, target, rng, events);
  }
}
