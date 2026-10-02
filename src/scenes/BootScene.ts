import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/display';
import { ATLAS } from '../config/sprites';
import type { GameSceneData } from './GameScene';

/** Carrega os assets (atlas de sprites do Marco 6b) e decide a primeira cena. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  preload(): void {
    this.load.spritesheet(ATLAS.key, ATLAS.url, { frameWidth: ATLAS.frame, frameHeight: ATLAS.frame });
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
