import type { RunState } from '../core/run';
import { deserializeRun, serializeRun } from '../core/save/runSave';

/**
 * Guarda a run suspensa no LocalStorage. Tudo em try/catch: aba anônima,
 * cota cheia ou storage bloqueado não podem derrubar o jogo — no pior
 * caso o "Continuar" simplesmente não aparece.
 */
const KEY = 'cryptveil.run';

export function saveRun(state: RunState): void {
  try {
    if (state.status === 'playing') localStorage.setItem(KEY, serializeRun(state));
    else localStorage.removeItem(KEY);
  } catch {
    // sem storage: segue sem save
  }
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? deserializeRun(raw) : null;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // idem
  }
}
