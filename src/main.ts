import Phaser from 'phaser';
import '@fontsource/vt323/400.css';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './config/display';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { HubScene } from './scenes/HubScene';
import { UIScene } from './scenes/UIScene';
import { installRenderScaling } from './view/scaling';

// O Phaser desenha texto em canvas: a fonte tem que estar carregada antes
// do primeiro texto, senão ele sai na fonte de fallback e não redesenha.
await document.fonts.load(`20px 'VT323'`).catch(() => undefined);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.BACKGROUND,
  pixelArt: true,
  roundPixels: true,
  fps: { target: 60 },
  input: {
    keyboard: true,
    gamepad: true,
  },
  scale: {
    // Tamanho do canvas e zoom controlados por nós — ver view/scaling.ts
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, HubScene, GameScene, UIScene, GameOverScene],
});

installRenderScaling(game);

// Atalho de debug no console do navegador: window.__game
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
