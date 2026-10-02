import type { EntityTemplate } from '../entities/Entity';

/**
 * Modelos de entidade. `.ts` com `satisfies` (não .json): id errado ou campo
 * faltando vira erro de compilação.
 *
 * Marco 4: monstros reais com stats FIXOS (um Rat é sempre um Rat); a
 * dificuldade sobe pela mistura de monstros e pela lotação das salas em cada
 * andar (balance.ts → FLOOR_SPAWNS). Números provisórios, calibrados pela
 * simulação headless (Marco 6 fecha).
 */
export const ENTITY_TEMPLATES = {
  // ATK/DEF do Knight SEM equipamento: com a Sword inicial (+3) fica ATK 11
  // (base 8 desde o Marco 6a: com a DEF em porcentagem, ATK é o que mais pesa)
  knight: { kind: 'player', name: 'Knight', glyph: 'K', maxHp: 50, atk: 8, def: 5 },

  rat: {
    kind: 'enemy',
    name: 'Rat',
    glyph: 'R',
    maxHp: 20,
    atk: 7,
    def: 0,
    ai: 'chase',
    reward: { xp: 4, goldMin: 1, goldMax: 3 },
    loot: 'rat',
  },
  goblin: {
    kind: 'enemy',
    name: 'Goblin',
    glyph: 'G',
    maxHp: 30,
    atk: 8,
    def: 1,
    ai: 'skirmisher',
    ranged: { range: 3, multiplier: 0.6, cooldown: 3, projectile: 'uma pedra' },
    reward: { xp: 6, goldMin: 2, goldMax: 4 },
    loot: 'goblin',
  },
  skeleton: {
    kind: 'enemy',
    name: 'Skeleton',
    glyph: 'S',
    maxHp: 44,
    atk: 10,
    def: 2,
    ai: 'chase',
    reward: { xp: 9, goldMin: 3, goldMax: 6 },
    loot: 'skeleton',
  },
  orc: {
    kind: 'enemy',
    name: 'Orc',
    glyph: 'O',
    maxHp: 56,
    atk: 14,
    def: 3,
    ai: 'skirmisher',
    ranged: { range: 4, multiplier: 0.7, cooldown: 4, projectile: 'uma lança' },
    reward: { xp: 13, goldMin: 4, goldMax: 8 },
    loot: 'orc',
  },
  /** Boss da Região 1 (§2.2): HP ~500, ATK 24 (rolagem 18–30), convoca Orc, enfurece < 30%. */
  orcWarlord: {
    kind: 'enemy',
    name: 'Orc Warlord',
    glyph: 'W',
    maxHp: 500,
    atk: 24,
    def: 2,
    ai: 'skirmisher',
    ranged: { range: 4, multiplier: 0.6, cooldown: 3, projectile: 'facas' },
    summon: { every: 3, max: 3 },
    enrage: { below: 0.3, multiplier: 1.5 },
    boss: true,
    reward: { xp: 60, goldMin: 45, goldMax: 55 },
    loot: 'orcWarlord',
  },

  /** Só pros testes (sala fixa do Marco 1): Goblin simples, corpo a corpo. */
  goblinDummy: {
    kind: 'enemy',
    name: 'Goblin',
    glyph: 'G',
    maxHp: 24,
    atk: 3,
    def: 1,
    ai: 'chase',
    reward: { xp: 4, goldMin: 1, goldMax: 3 },
    loot: 'goblin',
  },
} as const satisfies Record<string, EntityTemplate>;

export type EntityTemplateId = keyof typeof ENTITY_TEMPLATES;

/** Monstros que nascem nos andares (sorteio por andar em balance.ts). */
export type MonsterId = 'rat' | 'goblin' | 'skeleton' | 'orc';
