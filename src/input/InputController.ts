import Phaser from 'phaser';
import type { Action, SkillSlot } from '../core/actions';
import type { Direction } from '../core/grid';

/** Tempo segurando a direção até o primeiro passo repetido, e entre repetições. */
export const MOVE_REPEAT_DELAY_MS = 130;
export const MOVE_REPEAT_RATE_MS = 130;

/** Analógico abaixo disso é ignorado (drift de controle barato de fliperama). */
const STICK_DEADZONE = 0.5;

/** Gatilho/ombro analógico conta como apertado acima disso. */
const SHOULDER_THRESHOLD = 0.5;

/** Ordem dos botões no combo de ombro: LB+A = 1, LB+B = 2, LB+X = 3, LB+Y = 4 (RB: 5–8). */
export const CHORD_FACE_ORDER = ['A', 'B', 'X', 'Y'] as const;

export type InputSource = 'keyboard' | 'gamepad';

type ActionListener = (action: Action, source: InputSource) => void;

type KeyMap = Record<string, Phaser.Input.Keyboard.Key>;

/**
 * Traduz teclado + controle em Actions.
 *
 * Movimento: dispara ao apertar e repete enquanto segura (handoff §Marco 1).
 * Botões: só na borda de descida (um aperto = uma ação).
 *
 * Mapeamento (handoff §4.3):
 *   Teclado  — WASD/Setas: mover/atacar · Espaço: passar turno · 1–8: hotbar · I: inventário
 *              Enter: confirmar · Esc: cancelar · Q/E: aba anterior/próxima · M: mudo
 *   Controle — D-pad/analógico: mover/atacar · X: passar turno · A: confirmar · B: cancelar · Y: inventário · Select: mudo
 *              Segurando LB: A/B/X/Y = hotbar 1–4 · Segurando RB: A/B/X/Y = hotbar 5–8 (Marco 3)
 *              LB/RB sozinhos: aba anterior/próxima (só a tela de inventário usa)
 */
export class InputController {
  private readonly listeners: ActionListener[] = [];
  private readonly keys: KeyMap | null;

  private heldDir: Direction | null = null;
  private heldSource: InputSource = 'keyboard';
  private nextRepeatAt = 0;

  private prevPadButtons = { A: false, B: false, X: false, Y: false, LB: false, RB: false, SELECT: false };
  /**
   * Primeiro frame só lê o estado do controle: botão que já vinha apertado
   * da cena anterior (A que confirmou a troca de cena) não dispara de novo.
   */
  private padPrimed = false;

  /** Última origem usada — pra UI mostrar "A" ou "Enter" no futuro. */
  lastSource: InputSource = 'keyboard';

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    this.keys = kb
      ? (kb.addKeys(
          'W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,I,ENTER,SPACE,ESC,Q,E,M',
        ) as KeyMap)
      : null;
  }

  onAction(listener: ActionListener): void {
    this.listeners.push(listener);
  }

  /** Chamar uma vez por frame no update() da cena. */
  update(time: number): void {
    this.updateMovement(time);
    this.updateKeyboardButtons();
    this.updateGamepadButtons();
  }

  // ---------------------------------------------------------------- movimento

  private updateMovement(time: number): void {
    const kbDir = this.keyboardDirection();
    const padDir = this.gamepadDirection();
    const dir = kbDir ?? padDir;
    const source: InputSource = kbDir ? 'keyboard' : 'gamepad';

    if (dir === null) {
      this.heldDir = null;
      return;
    }

    if (dir !== this.heldDir) {
      // Direção nova: passo imediato
      this.heldDir = dir;
      this.heldSource = source;
      this.nextRepeatAt = time + MOVE_REPEAT_DELAY_MS;
      this.emit({ type: 'move', dir }, source);
      return;
    }

    if (time >= this.nextRepeatAt) {
      this.nextRepeatAt = time + MOVE_REPEAT_RATE_MS;
      this.emit({ type: 'move', dir }, this.heldSource);
    }
  }

  private keyboardDirection(): Direction | null {
    const k = this.keys;
    if (!k) return null;
    const down = (...names: string[]): boolean => names.some((n) => k[n]?.isDown === true);
    if (down('W', 'UP')) return 'N';
    if (down('S', 'DOWN')) return 'S';
    if (down('A', 'LEFT')) return 'W';
    if (down('D', 'RIGHT')) return 'E';
    return null;
  }

  private gamepadDirection(): Direction | null {
    const pad = this.pad();
    if (!pad) return null;
    if (pad.up) return 'N';
    if (pad.down) return 'S';
    if (pad.left) return 'W';
    if (pad.right) return 'E';

    const { x, y } = pad.leftStick;
    if (Math.max(Math.abs(x), Math.abs(y)) < STICK_DEADZONE) return null;
    // Eixo dominante vence — movimento é só 4 direções
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'E' : 'W';
    return y > 0 ? 'S' : 'N';
  }

  // ------------------------------------------------------------------ botões

  private updateKeyboardButtons(): void {
    const k = this.keys;
    if (!k) return;
    const just = (name: string): boolean => {
      const key = k[name];
      return key !== undefined && Phaser.Input.Keyboard.JustDown(key);
    };

    const skillKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'] as const;
    skillKeys.forEach((name, i) => {
      if (just(name)) this.emit({ type: 'skill', slot: (i + 1) as SkillSlot }, 'keyboard');
    });
    if (just('I')) this.emit({ type: 'inventory' }, 'keyboard');
    if (just('SPACE')) this.emit({ type: 'wait' }, 'keyboard');
    if (just('ENTER')) this.emit({ type: 'confirm' }, 'keyboard');
    if (just('ESC')) this.emit({ type: 'cancel' }, 'keyboard');
    if (just('Q')) this.emit({ type: 'page', delta: -1 }, 'keyboard');
    if (just('E')) this.emit({ type: 'page', delta: 1 }, 'keyboard');
    if (just('M')) this.emit({ type: 'mute' }, 'keyboard');
  }

  private updateGamepadButtons(): void {
    const pad = this.pad();
    if (!pad) return;
    const now = {
      A: pad.A,
      B: pad.B,
      X: pad.X,
      Y: pad.Y,
      LB: pad.L1 > SHOULDER_THRESHOLD,
      RB: pad.R1 > SHOULDER_THRESHOLD,
      // Select/Back (botão 8 no mapeamento padrão): mudo (Marco 6b)
      SELECT: pad.buttons[8]?.pressed === true,
    };
    const prev = this.prevPadButtons;
    this.prevPadButtons = now;
    if (!this.padPrimed) {
      this.padPrimed = true;
      return;
    }
    const pressed = (b: keyof typeof now): boolean => now[b] && !prev[b];

    if (pressed('SELECT')) this.emit({ type: 'mute' }, 'gamepad');
    if (pressed('LB')) this.emit({ type: 'page', delta: -1 }, 'gamepad');
    if (pressed('RB')) this.emit({ type: 'page', delta: 1 }, 'gamepad');

    // Combo: com um ombro segurado, os botões de face viram a hotbar (LB = 1–4, RB = 5–8)
    if (now.LB || now.RB) {
      const offset = now.LB ? 0 : 4;
      CHORD_FACE_ORDER.forEach((b, i) => {
        if (pressed(b)) this.emit({ type: 'skill', slot: (offset + i + 1) as SkillSlot }, 'gamepad');
      });
      return;
    }

    if (pressed('A')) this.emit({ type: 'confirm' }, 'gamepad');
    if (pressed('B')) this.emit({ type: 'cancel' }, 'gamepad');
    if (pressed('X')) this.emit({ type: 'wait' }, 'gamepad');
    if (pressed('Y')) this.emit({ type: 'inventory' }, 'gamepad');
  }

  // ------------------------------------------------------------------- util

  private pad(): Phaser.Input.Gamepad.Gamepad | null {
    const gp = this.scene.input.gamepad;
    if (!gp || gp.total === 0) return null;
    return gp.pad1 ?? null;
  }

  private emit(action: Action, source: InputSource): void {
    this.lastSource = source;
    for (const l of this.listeners) l(action, source);
  }
}
