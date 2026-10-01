import type Phaser from 'phaser';
import type { Action } from '../core/actions';
import type { Point } from '../core/grid';
import type { InputSource } from '../input/InputController';

/**
 * Eventos entre GameScene (mundo) e UIScene (HUD), tipados.
 * Usam o emissor global do jogo (game.events), então nenhuma cena
 * precisa segurar referência da outra.
 */
export interface GameEvents {
  'run-started': { seed: number };
  'tile-clicked': { tile: Point };
  'action': { action: Action; source: InputSource };
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
