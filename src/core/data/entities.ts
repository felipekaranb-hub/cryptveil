import type { EntityTemplate } from '../entities/Entity';

/**
 * Modelos de entidade. `.ts` com `satisfies` (não .json): id errado ou campo
 * faltando vira erro de compilação.
 *
 * Marco 1: só o Knight e o Goblin "dummy" do vertical slice.
 * Marco 4: Rat, Skeleton, Goblin real, Orc e Orc Warlord com loot tables.
 */
export const ENTITY_TEMPLATES = {
  // ATK/DEF do Knight SEM equipamento: com a Sword inicial (+3) fica ATK 10
  knight: { kind: 'player', name: 'Knight', glyph: 'K', maxHp: 50, atk: 7, def: 5 },
  goblinDummy: {
    kind: 'enemy',
    name: 'Goblin',
    glyph: 'G',
    // Marco 2c: HP maior pra +ATK mudar o número de golpes (era 15)
    maxHp: 24,
    atk: 3,
    def: 1,
    ai: 'chase',
    reward: { xp: 4, goldMin: 1, goldMax: 3 },
    loot: 'goblin',
  },
} as const satisfies Record<string, EntityTemplate>;

export type EntityTemplateId = keyof typeof ENTITY_TEMPLATES;
