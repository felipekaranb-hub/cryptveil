import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/display';

/** Carrega assets (vazio até o Marco 6 trocar os quadrados por sprites). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  preload(): void {
    // Marco 6: spritesheets, tileset e fonte pixel entram aqui
  }

  create(): void {
    this.scene.start(SCENE_KEYS.GAME);
  }
}
