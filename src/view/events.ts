import type Phaser from 'phaser';
import type { Point } from '../core/grid';
import type { RunStatus } from '../core/run';

/**
 * Eventos entre GameScene (mundo) e UIScene (HUD), tipados.
 * Usam o emissor global do jogo (game.events), então nenhuma cena
 * precisa segurar referência da outra.
 */
export interface GameEvents {
  'run-started': { seed: number };
  /** Achou run suspensa: a UI pergunta se continua (Enter/A) ou começa outra (Esc/B). */
  'resume-offered': { seed: number; floor: number; turn: number };
  'tile-clicked': { tile: Point };
  /** Linhas novas pro LOG de combate. */
  'log': { lines: string[] };
  'player-status': {
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    atk: number;
    def: number;
    level: number;
    xp: number;
    xpNext: number;
    gold: number;
    turn: number;
    floor: number;
    potions: { hp: number; mana: number };
    /** Linha da hotbar pronta ("1 Brutal Strike (5) · 2 — · …"). */
    hotbar: string;
    /** Nome do item em cada slot mostrado (ou '—'). */
    gear: { weapon: string; armor: string; helmet: string; shield: string };
  };
  /** Escolha aberta/atualizada: cartas do level up ou opções da Training Room. */
  'choice-prompt': { title: string; options: ChoiceOption[]; selected: number };
  'choice-closed': Record<string, never>;
  'run-ended': { result: Exclude<RunStatus, 'playing'>; turns: number };
}

/** Uma carta na tela de escolha (texto já pronto pra exibir). */
export interface ChoiceOption {
  title: string;
  subtitle: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'training';
}

export type GameEventName = keyof GameEvents;

export function emitGameEvent<K extends GameEventName>(
  emitter: Phaser.Events.EventEmitter,
  name: K,
  payload: GameEvents[K],
): void {
  emitter.emit(name, payload);
}

export function onGameEvent<K extends GameEventName>(
  emitter: Phaser.Events.EventEmitter,
  name: K,
  handler: (payload: GameEvents[K]) => void,
  context?: unknown,
): void {
  emitter.on(name, handler, context);
}

export function offGameEvent<K extends GameEventName>(
  emitter: Phaser.Events.EventEmitter,
  name: K,
  handler: (payload: GameEvents[K]) => void,
  context?: unknown,
): void {
  emitter.off(name, handler, context);
}
