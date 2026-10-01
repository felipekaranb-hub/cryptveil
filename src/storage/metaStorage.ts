import { applyRunResult, createMeta, deserializeMeta, serializeMeta, type MetaProgress, type RunSummary } from '../core/meta/metaProgress';
import type { RunState } from '../core/run';

/**
 * Meta-progressão no LocalStorage (Marco 5). Mesmo cuidado do runStorage:
 * storage bloqueado não derruba o jogo, só não guarda.
 * Save ilegível não é apagado (fica pra investigar); o jogo começa uma meta nova
 * e só sobrescreve quando houver algo pra salvar.
 */
const KEY = 'cryptveil.meta';

export function loadMeta(): MetaProgress {
  try {
    const raw = localStorage.getItem(KEY);
    return (raw ? deserializeMeta(raw) : null) ?? createMeta();
  } catch {
    return createMeta();
  }
}

export function saveMeta(meta: MetaProgress): void {
  try {
    localStorage.setItem(KEY, serializeMeta(meta));
  } catch {
    // sem storage: segue sem save
  }
}

/** Fecha a run na meta salva (converte gold, soma kills) e devolve o resumo. */
export function closeRun(run: RunState, outcome: RunSummary['outcome']): RunSummary {
  const meta = loadMeta();
  const summary = applyRunResult(meta, run, outcome);
  saveMeta(meta);
  return summary;
}
