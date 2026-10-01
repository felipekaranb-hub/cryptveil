import { describe, expect, it } from 'vitest';
import { maxedMeta, runBonuses } from '../meta/metaProgress';
import { simulateRun, summarize } from './simulate';

/**
 * Smoke test do simulador (rápido). Pra rodar a simulação de verdade:
 *   SIM=200 npx vitest run src/core/sim
 */
// process sem @types/node: o core não depende de Node
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
const SIM = Number(env?.['SIM'] ?? 0);

describe('simulação headless', () => {
  it('o bot joga runs inteiras sem travar e é determinístico', () => {
    const a = simulateRun(7, 600);
    expect(a).toEqual(simulateRun(7, 600));
    expect(a.turns).toBeGreaterThan(0);
  });

  it.runIf(SIM > 0)(`balanceamento: ${SIM} runs`, { timeout: 600_000 }, () => {
    const reports = Array.from({ length: SIM }, (_, i) => simulateRun(i + 1));
    console.log(JSON.stringify(summarize(reports), null, 2));
  });

  // Marco 5: a mesma régua com o Sanctum inteiro comprado (teto da meta)
  it.runIf(SIM > 0)(`balanceamento com a meta no máximo: ${SIM} runs`, { timeout: 600_000 }, () => {
    const bonuses = runBonuses(maxedMeta());
    const reports = Array.from({ length: SIM }, (_, i) => simulateRun(i + 1, 4000, bonuses));
    console.log('META MÁXIMA', JSON.stringify(summarize(reports), null, 2));
  });
});
