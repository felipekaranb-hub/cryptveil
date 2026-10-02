/**
 * Preferências do jogador (Marco 6b): por enquanto só o mudo. Fora da meta
 * de propósito: não é progresso, e apagar a meta não deve ligar o som.
 */
const KEY = 'cryptveil.settings';

export interface Settings {
  muted: boolean;
}

const DEFAULTS: Settings = { muted: false };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (typeof data === 'object' && data !== null && typeof (data as Settings).muted === 'boolean') {
      return { muted: (data as Settings).muted };
    }
  } catch {
    // storage bloqueado ou texto inválido: padrão
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // sem storage: segue sem salvar
  }
}
