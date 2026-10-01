import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';

/**
 * Escala de renderização.
 *
 * O jogo é pensado em 960×540 "pixels lógicos" (todas as coordenadas do
 * código usam isso). Mas o canvas é desenhado na resolução REAL da tela,
 * em pixels físicos — inclusive em notebook com escala do Windows em
 * 125%/150% e celular com tela retina. Isso deixa texto e bordas nítidos.
 *
 * renderScale = quantos pixels físicos cada pixel lógico ocupa.
 * - ≥ 2: arredonda pra baixo (inteiro) → pixel art perfeitamente uniforme.
 * - < 2: usa o valor fracionário pra preencher a tela; com tão pouca
 *   resolução, sobrar borda preta seria pior que pixels levemente desiguais.
 */
export function computeRenderScale(cssW: number, cssH: number, dpr: number): number {
  const fit = Math.min((cssW * dpr) / GAME_WIDTH, (cssH * dpr) / GAME_HEIGHT);
  if (fit >= 2) return Math.floor(fit);
  return Math.max(fit, 0.25);
}

export const RENDER_SCALE_EVENT = 'render-scale-changed';

let currentScale = 1;

export function getRenderScale(): number {
  return currentScale;
}

export function installRenderScaling(game: Phaser.Game): void {
  const apply = (): void => {
    const parent = game.scale.parent as HTMLElement | null;
    const cssW = parent?.clientWidth || window.innerWidth;
    const cssH = parent?.clientHeight || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    const scale = computeRenderScale(cssW, cssH, dpr);
    const canvasW = Math.round(GAME_WIDTH * scale);
    const canvasH = Math.round(GAME_HEIGHT * scale);

    // Canvas em pixels físicos; o zoom 1/dpr devolve o tamanho certo em CSS
    game.scale.resize(canvasW, canvasH);
    game.scale.setZoom(1 / dpr);

    if (scale !== currentScale) {
      currentScale = scale;
      game.events.emit(RENDER_SCALE_EVENT, scale);
    }
  };

  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  document.addEventListener('fullscreenchange', apply);
}

/**
 * Faz uma cena trabalhar em coordenadas lógicas (960×540) qualquer que seja
 * o tamanho real do canvas. `layout` recebe a escala e posiciona as câmeras;
 * os textos da cena ganham resolução compatível pra não ficarem borrados.
 */
export function bindRenderScale(scene: Phaser.Scene, layout: (scale: number) => void): void {
  const onScale = (scale: number): void => {
    layout(scale);
    for (const obj of scene.children.list) {
      if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(scale);
    }
  };

  onScale(currentScale);
  scene.game.events.on(RENDER_SCALE_EVENT, onScale);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.game.events.off(RENDER_SCALE_EVENT, onScale);
  });
}

/** Câmera em coordenadas lógicas: viewport e zoom multiplicados pela escala. */
export function layoutCamera(
  cam: Phaser.Cameras.Scene2D.Camera,
  scale: number,
  view: { x: number; y: number; width: number; height: number },
): void {
  cam.setViewport(
    Math.round(view.x * scale),
    Math.round(view.y * scale),
    Math.round(view.width * scale),
    Math.round(view.height * scale),
  );
  cam.setOrigin(0, 0);
  cam.setZoom(scale);
}
