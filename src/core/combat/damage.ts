import { DAMAGE_VARIANCE, DEF_MITIGATION_K, MIN_DAMAGE } from '../balance';
import type { Rng } from '../rng';

/**
 * Fórmula de dano (handoff §2.12, mudou no Marco 6a):
 *
 *   rolagem = sorteio inteiro em [round(ATK × 0,75), round(ATK × 1,25)]
 *   dano    = max(1, round(rolagem × K / (K + DEF)))     K = DEF_MITIGATION_K
 *
 * A faixa resolve a inconsistência do boss ("dano 18–30") e dá o sabor
 * de Tibia. A redução percentual (era `rolagem − DEF`) impede que a DEF
 * empilhada do Knight transforme todo monstro em "1 de dano".
 */
export function damageRange(atk: number): { min: number; max: number } {
  const min = Math.max(0, Math.round(atk * (1 - DAMAGE_VARIANCE)));
  const max = Math.max(min, Math.round(atk * (1 + DAMAGE_VARIANCE)));
  return { min, max };
}

/** Quanto sobra de uma rolagem depois da DEF do alvo. */
export function mitigate(roll: number, def: number): number {
  return Math.max(MIN_DAMAGE, Math.round((roll * DEF_MITIGATION_K) / (DEF_MITIGATION_K + Math.max(0, def))));
}

export function rollDamage(atk: number, def: number, rng: Rng): number {
  const { min, max } = damageRange(atk);
  return mitigate(rng.int(min, max), def);
}
