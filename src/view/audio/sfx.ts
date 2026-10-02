/**
 * Efeitos sonoros sintetizados na hora pela Web Audio API (Marco 6b): sem
 * arquivo de áudio, nada pra baixar, roda offline no fliperama. Música fica
 * pra depois (decisão do Felipe). Mudo: M no teclado, Select no controle.
 *
 * O AudioContext só nasce no primeiro som (o navegador exige um gesto do
 * usuário antes; aperto de tecla ou botão conta).
 */
import { loadSettings, saveSettings } from '../../storage/settingsStorage';

export type SfxName =
  | 'hit'
  | 'crit'
  | 'hurt'
  | 'kill'
  | 'death'
  | 'throw'
  | 'heal'
  | 'mana'
  | 'levelUp'
  | 'loot'
  | 'gold'
  | 'stairs'
  | 'buy'
  | 'uiMove'
  | 'uiConfirm'
  | 'uiDeny'
  | 'enrage'
  | 'summon'
  | 'victory';

const MASTER_VOLUME = 0.22;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = loadSettings().muted;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return master ? { ctx, out: master } : null;
}

interface Tone {
  type: OscillatorType;
  from: number;
  to?: number;
  /** Início (s) relativo ao som. */
  at?: number;
  dur: number;
  vol?: number;
}

function tone(a: { ctx: AudioContext; out: GainNode }, t: Tone): void {
  const start = a.ctx.currentTime + (t.at ?? 0);
  const osc = a.ctx.createOscillator();
  const gain = a.ctx.createGain();
  osc.type = t.type;
  osc.frequency.setValueAtTime(t.from, start);
  if (t.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, t.to), start + t.dur);
  const vol = t.vol ?? 0.6;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
  osc.connect(gain).connect(a.out);
  osc.start(start);
  osc.stop(start + t.dur + 0.02);
}

/** Ruído branco filtrado (golpe, arremesso). */
function noise(a: { ctx: AudioContext; out: GainNode }, dur: number, freq: number, vol = 0.5, at = 0): void {
  const start = a.ctx.currentTime + at;
  const len = Math.max(1, Math.floor(a.ctx.sampleRate * dur));
  const buffer = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Ruído determinístico basta: ninguém ouve a diferença, e evita Math.random
  let seed = 22222;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  const src = a.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(gain).connect(a.out);
  src.start(start);
}

const SOUNDS: Record<SfxName, (a: { ctx: AudioContext; out: GainNode }) => void> = {
  hit: (a) => {
    noise(a, 0.08, 1800, 0.5);
    tone(a, { type: 'square', from: 180, to: 90, dur: 0.08, vol: 0.25 });
  },
  crit: (a) => {
    noise(a, 0.12, 2400, 0.6);
    tone(a, { type: 'square', from: 520, to: 140, dur: 0.14, vol: 0.3 });
  },
  hurt: (a) => tone(a, { type: 'sawtooth', from: 320, to: 110, dur: 0.16, vol: 0.3 }),
  kill: (a) => {
    noise(a, 0.18, 900, 0.4);
    tone(a, { type: 'triangle', from: 300, to: 60, dur: 0.22, vol: 0.4 });
  },
  death: (a) => {
    tone(a, { type: 'sawtooth', from: 220, to: 40, dur: 0.9, vol: 0.35 });
    tone(a, { type: 'triangle', from: 110, to: 30, at: 0.1, dur: 1.0, vol: 0.4 });
  },
  throw: (a) => noise(a, 0.12, 3000, 0.25),
  heal: (a) => tone(a, { type: 'sine', from: 440, to: 880, dur: 0.25, vol: 0.35 }),
  mana: (a) => tone(a, { type: 'sine', from: 660, to: 990, dur: 0.18, vol: 0.25 }),
  levelUp: (a) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(a, { type: 'square', from: f, at: i * 0.08, dur: 0.12, vol: 0.22 }));
  },
  loot: (a) => {
    tone(a, { type: 'square', from: 880, at: 0, dur: 0.06, vol: 0.18 });
    tone(a, { type: 'square', from: 1320, at: 0.06, dur: 0.08, vol: 0.18 });
  },
  gold: (a) => tone(a, { type: 'triangle', from: 1568, to: 2093, dur: 0.07, vol: 0.18 }),
  stairs: (a) => {
    [392, 330, 262, 196].forEach((f, i) => tone(a, { type: 'triangle', from: f, at: i * 0.09, dur: 0.12, vol: 0.35 }));
  },
  buy: (a) => {
    tone(a, { type: 'square', from: 1319, dur: 0.06, vol: 0.18 });
    tone(a, { type: 'square', from: 1760, at: 0.07, dur: 0.12, vol: 0.18 });
  },
  uiMove: (a) => tone(a, { type: 'square', from: 660, dur: 0.03, vol: 0.12 }),
  uiConfirm: (a) => tone(a, { type: 'square', from: 880, to: 1320, dur: 0.07, vol: 0.16 }),
  uiDeny: (a) => tone(a, { type: 'square', from: 200, to: 150, dur: 0.12, vol: 0.18 }),
  enrage: (a) => {
    tone(a, { type: 'sawtooth', from: 90, to: 60, dur: 0.6, vol: 0.4 });
    noise(a, 0.4, 300, 0.3);
  },
  summon: (a) => tone(a, { type: 'triangle', from: 120, to: 240, dur: 0.3, vol: 0.3 }),
  victory: (a) => {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
      tone(a, { type: 'square', from: f, at: i * 0.12, dur: 0.16, vol: 0.22 }),
    );
  },
};

export function playSfx(name: SfxName): void {
  if (muted) return;
  try {
    const a = audio();
    if (a) SOUNDS[name](a);
  } catch {
    // áudio bloqueado ou indisponível: segue em silêncio
  }
}

export function isMuted(): boolean {
  return muted;
}

/** Liga/desliga o som e guarda a escolha. Devolve o estado novo. */
export function toggleMute(): boolean {
  muted = !muted;
  saveSettings({ ...loadSettings(), muted });
  if (!muted) playSfx('uiConfirm');
  return muted;
}
