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
 */
type Migration = (old: Record<string, unknown>) => Record<string, unknown> | null;

const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: () => null,
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
  return current.status === 'playing' ? current : null;
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
  if (!Array.isArray(v['rooms'])) return false;
  for (const key of ['seed', 'turn', 'floor'] as const) {
    if (typeof v[key] !== 'number') return false;
  }
  if (typeof v['status'] !== 'string' || typeof v['playerId'] !== 'string') return false;
  return entities.some((e) => isRecord(e) && e['id'] === v['playerId']);
}
