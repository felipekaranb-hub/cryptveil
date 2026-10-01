import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './config/display';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { installRenderScaling } from './view/scaling';

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
  scene: [BootScene, GameScene, UIScene],
});

installRenderScaling(game);

// Atalho de debug no console do navegador: window.__game
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
