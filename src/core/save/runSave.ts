import { revealAround } from '../fog';
import { createKnightHero } from '../hero';
import { RUN_STATE_VERSION, type RunState } from '../run';

/**
 * Save da run em andamento ("suspender automático", handoff §4.6).
 * Aqui só o formato: texto ↔ RunState, com versão e migração.
 * Onde guardar (LocalStorage) é problema da camada de fora (src/storage).
 */

export function serializeRun(state: RunState): string {
  return JSON.stringify(state);
}

/**
 * Migrações: versão antiga → objeto da versão seguinte, ou null pra descartar.
 * v1 (Marco 1, sala fixa) nunca foi salvo de verdade: descarta.
 * v2 (Marco 2a) → v3: ganha o herói do Knight com o equipamento inicial
 * (ATK/DEF efetivos são os mesmos do v2) e começa a contar salas do zero.
 * Monstros já vivos no andar não dão XP/loot; os dos próximos andares, sim.
 * v3 (Marco 2b) → v4: prompt vira objeto; o Knight do v3 tinha as 4 skills,
 * então mantém todas no nível 1; sem cartas.
 * v4 (Marco 2d) → v5: fog of war; o andar começa sem nada explorado e o
 * deserializeRun revela o que o Knight vê de onde está.
 * v5 (Marco 3) → v6: relíquias (nenhuma), sem mercador e sem escada escondida
 * no andar atual. Os monstros provisórios já vivos continuam como estão; os
 * próximos andares nascem com os monstros reais.
 * v6 (Marco 4) → v7: herói sem bônus de meta (a run começou antes do Sanctum)
 * e kills contando a partir de agora.
 * v7 → v8: recargas zeradas (todas as skills prontas). O Orc Warlord já vivo
 * no andar mantém os stats antigos; os próximos nascem com os novos.
 */
type Migration = (old: Record<string, unknown>) => Record<string, unknown> | null;

const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: () => null,
  2: (old) => ({ ...old, version: 3, hero: createKnightHero(), visitedRooms: [], clearedRooms: [], prompt: null }),
  3: (old) => {
    const hero = isRecord(old['hero']) ? old['hero'] : {};
    return {
      ...old,
      version: 4,
      prompt: old['prompt'] === 'training' ? { type: 'training' } : null,
      hero: {
        ...hero,
        skills: { brutalStrike: 1, berserk: 1, whirlwindThrow: 1, woundCleansing: 1 },
        cards: {},
        pendingCardPicks: 0,
      },
    };
  },
  4: (old) => ({ ...old, version: 5, explored: [] }),
  5: (old) => ({
    ...old,
    version: 6,
    merchant: null,
    hiddenStairs: null,
    hero: { ...(isRecord(old['hero']) ? old['hero'] : {}), relics: [] },
  }),
  6: (old) => ({
    ...old,
    version: 7,
    runStats: { kills: {} },
    hero: { ...(isRecord(old['hero']) ? old['hero'] : {}), xpBonusPct: 0, bonusOfferCards: 0, rerolls: 0 },
  }),
  7: (old) => ({ ...old, version: 8, hero: { ...(isRecord(old['hero']) ? old['hero'] : {}), cooldowns: {} } }),
};

/**
 * Lê um save. Devolve null se o texto não for um save válido, for de uma
 * versão que não migra, ou for de uma run que já acabou (morte apaga o save).
 */
export function deserializeRun(raw: string): RunState | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  let current: Record<string, unknown> | null = data;
  while (current && current['version'] !== RUN_STATE_VERSION) {
    const version: unknown = current['version'];
    const migrate: Migration | undefined = typeof version === 'number' ? MIGRATIONS[version] : undefined;
    current = migrate ? migrate(current) : null;
  }
  if (!current || !looksLikeRun(current)) return null;
  if (current.status !== 'playing') return null;
  // Idempotente: num save atual não muda nada; num migrado, revela a sala atual
  revealAround(current);
  return current;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Checagem de forma: o bastante pra não abrir o jogo num estado quebrado. */
function looksLikeRun(v: Record<string, unknown>): v is Record<string, unknown> & RunState {
  const map = v['map'];
  const rng = v['rngState'];
  const entities = v['entities'];
  if (!isRecord(map) || !Array.isArray(entities) || !Array.isArray(rng) || rng.length !== 4) return false;
  if (typeof map['width'] !== 'number' || typeof map['height'] !== 'number') return false;
  if (!Array.isArray(map['tiles']) || map['tiles'].length !== map['width'] * map['height']) return false;
  if (!Array.isArray(v['rooms']) || !Array.isArray(v['visitedRooms']) || !Array.isArray(v['clearedRooms'])) {
    return false;
  }
  if (!Array.isArray(v['explored']) || !v['explored'].every((k) => typeof k === 'number')) {
    return false;
  }
  const hero = v['hero'];
  if (!isRecord(hero) || !Array.isArray(hero['bag']) || !isRecord(hero['equipment'])) return false;
  if (!isRecord(hero['skills']) || !isRecord(hero['cards']) || !Array.isArray(hero['relics'])) return false;
  for (const key of ['xpBonusPct', 'bonusOfferCards', 'rerolls'] as const) {
    if (typeof hero[key] !== 'number') return false;
  }
  if (!isRecord(hero['cooldowns'])) return false;
  const stats = v['runStats'];
  if (!isRecord(stats) || !isRecord(stats['kills'])) return false;
  for (const key of ['seed', 'turn', 'floor'] as const) {
    if (typeof v[key] !== 'number') return false;
  }
  if (typeof v['status'] !== 'string' || typeof v['playerId'] !== 'string') return false;
  return entities.some((e) => isRecord(e) && e['id'] === v['playerId']);
}
