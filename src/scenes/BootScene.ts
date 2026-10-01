import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/display';
import type { GameSceneData } from './GameScene';

/** Carrega assets (vazio até o Marco 6 trocar os quadrados por sprites). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  preload(): void {
    // Marco 6: spritesheets, tileset e fonte pixel entram aqui
  }

  create(): void {
    // ?seed= na URL é pra reproduzir bug: pula o Sanctum e ignora a run suspensa
    // (ela fica guardada até o próximo save desta run nova). Sem seed: Sanctum.
    const fromUrl = Number(new URLSearchParams(window.location.search).get('seed'));
    if (Number.isInteger(fromUrl) && fromUrl > 0) {
      this.scene.start(SCENE_KEYS.GAME, { seed: fromUrl } satisfies GameSceneData);
    } else {
      this.scene.start(SCENE_KEYS.HUB);
    }
  }
}
