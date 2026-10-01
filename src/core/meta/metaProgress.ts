import { META } from '../balance';
import { ENTITY_TEMPLATES } from '../data/entities';
import { BESTIARY, maxUpgradeLevel, UPGRADES, type SpeciesId, type UpgradeId } from '../data/sanctum';
import type { RunState } from '../run';

/**
 * Meta-progressão (Marco 5): o que sobrevive entre runs. JSON puro, com
 * versão e migração como o save da run. Onde guardar (LocalStorage) é da
 * camada de fora (src/storage/metaStorage.ts).
 */
export const META_VERSION = 1;

export interface MetaProgress {
  readonly version: typeof META_VERSION;
  /** Gold guardado no Sanctum (já convertido). */
  gold: number;
  /** Nível comprado de cada upgrade (ausente = 0). */
  upgrades: Partial<Record<UpgradeId, number>>;
  /** Bestiário: kills do player por monstro, somando todas as runs. */
  kills: Partial<Record<SpeciesId, number>>;
  runs: number;
  wins: number;
  /** Andar mais fundo alcançado numa run. */
  bestFloor: number;
}

export function createMeta(): MetaProgress {
  return { version: META_VERSION, gold: 0, upgrades: {}, kills: {}, runs: 0, wins: 0, bestFloor: 0 };
}

export function upgradeLevel(meta: MetaProgress, id: UpgradeId): number {
  return meta.upgrades[id] ?? 0;
}

/** Preço do próximo nível, ou null se já está no máximo. */
export function nextUpgradeCost(meta: MetaProgress, id: UpgradeId): number | null {
  return UPGRADES[id].costs[upgradeLevel(meta, id)] ?? null;
}

export type BuyFailure = 'maxed' | 'no-gold';

export function buyUpgrade(meta: MetaProgress, id: UpgradeId): true | BuyFailure {
  const cost = nextUpgradeCost(meta, id);
  if (cost === null) return 'maxed';
  if (meta.gold < cost) return 'no-gold';
  meta.gold -= cost;
  meta.upgrades[id] = upgradeLevel(meta, id) + 1;
  return true;
}

/** Fração do gold que sobrou que vira gold do Sanctum. */
export function conversionRate(meta: MetaProgress, won: boolean): number {
  if (won) return META.winConversion;
  const rates = META.deathConversion;
  return rates[Math.min(upgradeLevel(meta, 'vault'), rates.length - 1)] ?? 0;
}

/**
 * O que os upgrades comprados dão a uma run nova. Aplicado no createRun e
 * gravado no herói (o save da run não depende da meta depois de criada).
 */
export interface RunBonuses {
  readonly atk: number;
  readonly maxHp: number;
  /** Escolhas de carta que vêm com +1 opção (Saber 1). */
  readonly bonusOfferCards: number;
  /** Começa a run com uma escolha de carta aberta (Saber 2). */
  readonly startingCard: boolean;
  readonly xpPct: number;
  readonly rerolls: number;
}

export const NO_BONUSES: RunBonuses = { atk: 0, maxHp: 0, bonusOfferCards: 0, startingCard: false, xpPct: 0, rerolls: 0 };

export function runBonuses(meta: MetaProgress): RunBonuses {
  const wisdom = upgradeLevel(meta, 'wisdom');
  return {
    atk: upgradeLevel(meta, 'sharpen') * META.sharpenAtk,
    maxHp: upgradeLevel(meta, 'reinforce') * META.reinforceHp,
    bonusOfferCards: wisdom >= 1 ? 1 : 0,
    startingCard: wisdom >= 2,
    xpPct: wisdom >= 3 ? META.wisdomXpPct : 0,
    rerolls: upgradeLevel(meta, 'reread') * META.rerollsPerLevel,
  };
}

/** Meta com tudo no máximo (simulação e testes). */
export function maxedMeta(): MetaProgress {
  const meta = createMeta();
  for (const id of Object.keys(UPGRADES) as UpgradeId[]) meta.upgrades[id] = maxUpgradeLevel(id);
  return meta;
}

/** Resumo do fim da run (GameOverScene). */
export interface RunSummary {
  readonly outcome: 'won' | 'lost' | 'abandoned';
  readonly seed: number;
  readonly floor: number;
  readonly level: number;
  readonly turns: number;
  /** Kills da run por monstro, na ordem do bestiário. */
  readonly kills: readonly { readonly species: SpeciesId; readonly name: string; readonly count: number }[];
  readonly goldLeft: number;
  readonly rate: number;
  readonly converted: number;
  /** Gold do Sanctum depois de somar. */
  readonly metaGold: number;
}

/**
 * Fecha a run na meta: converte o gold que sobrou, soma as kills no
 * bestiário e atualiza os recordes. MUTA a meta. Run abandonada (nova run
 * por cima da suspensa) conta como morte.
 */
export function applyRunResult(meta: MetaProgress, run: RunState, outcome: RunSummary['outcome']): RunSummary {
  const won = outcome === 'won';
  const rate = conversionRate(meta, won);
  const goldLeft = run.hero.gold;
  const converted = Math.floor(goldLeft * rate);
  meta.gold += converted;
  meta.runs += 1;
  if (won) meta.wins += 1;
  meta.bestFloor = Math.max(meta.bestFloor, run.floor);

  const kills: { species: SpeciesId; name: string; count: number }[] = [];
  for (const species of BESTIARY) {
    const name = ENTITY_TEMPLATES[species].name;
    const count = run.runStats.kills[name] ?? 0;
    if (count <= 0) continue;
    meta.kills[species] = (meta.kills[species] ?? 0) + count;
    kills.push({ species, name, count });
  }

  return {
    outcome,
    seed: run.seed,
    floor: run.floor,
    level: run.hero.level,
    turns: run.turn,
    kills,
    goldLeft,
    rate,
    converted,
    metaGold: meta.gold,
  };
}

// ---------------------------------------------------------------- save

export function serializeMeta(meta: MetaProgress): string {
  return JSON.stringify(meta);
}

type Migration = (old: Record<string, unknown>) => Record<string, unknown> | null;

/** Nenhuma ainda: v1 é a primeira. Formato mudou → suba META_VERSION e migre aqui. */
const MIGRATIONS: Readonly<Record<number, Migration>> = {};

/**
 * Lê a meta salva. Texto inválido devolve null (quem chama decide: o
 * storage começa uma meta nova, sem apagar o texto velho).
 */
export function deserializeMeta(raw: string): MetaProgress | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  let current: Record<string, unknown> | null = isRecord(data) ? data : null;
  while (current && current['version'] !== META_VERSION) {
    const version: unknown = current['version'];
    const migrate = typeof version === 'number' ? MIGRATIONS[version] : undefined;
    current = migrate ? migrate(current) : null;
  }
  if (!current || !looksLikeMeta(current)) return null;
  return current;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isCountMap(v: unknown): boolean {
  return isRecord(v) && Object.values(v).every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0);
}

function looksLikeMeta(v: Record<string, unknown>): v is Record<string, unknown> & MetaProgress {
  for (const key of ['gold', 'runs', 'wins', 'bestFloor'] as const) {
    if (typeof v[key] !== 'number' || !Number.isFinite(v[key]) || v[key] < 0) return false;
  }
  return isCountMap(v['upgrades']) && isCountMap(v['kills']);
}
