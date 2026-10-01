import { DAMAGE_VARIANCE, MIN_DAMAGE } from '../balance';
import type { Rng } from '../rng';

/**
 * Fórmula de dano (handoff v2 §2.12):
 *
 *   rolagem = sorteio inteiro em [round(ATK × 0,75), round(ATK × 1,25)]
 *   dano    = max(1, rolagem − DEF)
 *
 * A faixa resolve a inconsistência do boss ("dano 18–30") e dá o sabor
 * de Tibia. O empilhamento de DEF fica de olho no balanceamento (Marco 6).
 */
export function damageRange(atk: number): { min: number; max: number } {
  const min = Math.max(0, Math.round(atk * (1 - DAMAGE_VARIANCE)));
  const max = Math.max(min, Math.round(atk * (1 + DAMAGE_VARIANCE)));
  return { min, max };
}

export function rollDamage(atk: number, def: number, rng: Rng): number {
  const { min, max } = damageRange(atk);
  const roll = rng.int(min, max);
  return Math.max(MIN_DAMAGE, roll - def);
}
