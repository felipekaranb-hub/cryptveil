import type { EntityTemplate } from '../entities/Entity';

/**
 * Modelos de entidade. `.ts` com `satisfies` (não .json): id errado ou campo
 * faltando vira erro de compilação.
 *
 * Marco 1: só o Knight e o Goblin "dummy" do vertical slice.
 * Marco 4: Rat, Skeleton, Goblin real, Orc e Orc Warlord com loot tables.
 */
export const ENTITY_TEMPLATES = {
  knight: { kind: 'player', name: 'Knight', glyph: 'K', maxHp: 50, atk: 10, def: 5 },
  goblinDummy: { kind: 'enemy', name: 'Goblin', glyph: 'G', maxHp: 15, atk: 3, def: 1, ai: 'chase' },
} as const satisfies Record<string, EntityTemplate>;

export type EntityTemplateId = keyof typeof ENTITY_TEMPLATES;
