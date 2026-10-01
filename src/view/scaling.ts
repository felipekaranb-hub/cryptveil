import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';

/**
 * Escala da tela.
 *
 * - Tela maior que 960×540: zoom INTEIRO (2×, 3×, 4×) → pixels sempre iguais.
 * - Tela menor (celular): zoom fracionário pra caber. Fica um pouco menos
 *   nítido, mas é melhor que cortar a tela.
 */
export function computeZoom(viewW: number, viewH: number): number {
  const fit = Math.min(viewW / GAME_WIDTH, viewH / GAME_HEIGHT);
  if (fit >= 1) return Math.floor(fit);
  return fit;
}

export function installPixelPerfectScaling(game: Phaser.Game): void {
  const apply = (): void => {
    const parent = game.scale.parent as HTMLElement | null;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    const zoom = computeZoom(w, h);
    if (game.scale.zoom !== zoom) game.scale.setZoom(zoom);
  };

  apply();
  window.addEventListener('resize', apply);
  // Celular girando, tela cheia etc.
  window.addEventListener('orientationchange', apply);
  document.addEventListener('fullscreenchange', apply);
}
