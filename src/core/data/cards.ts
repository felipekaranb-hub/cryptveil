import type { SkillId } from './skills';

/**
 * Cartas do level up (Marco 2d): a cada nível o jogo oferece 3 e o player
 * fica com 1. O conjunto de cartas da run é o "deck" do build.
 *
 * - Carta de SKILL: libera a skill; se já tem, sobe o nível (até o 3).
 * - Demais: stat ou passiva, empilhando até `maxStacks`.
 * Crítico e contra-ataque são efeito de carta, não stat novo (§2.6 continua
 * só ATK e DEF). Números provisórios (calibrados na simulação headless).
 */
export type CardRarity = 'common' | 'rare' | 'epic';

export type CardEffect =
  | { readonly type: 'atk-pct'; readonly pct: number }
  | { readonly type: 'max-hp'; readonly amount: number }
  | { readonly type: 'def'; readonly amount: number }
  | { readonly type: 'max-mana'; readonly amount: number }
  /** Cura essa fração do dano que o player causa. */
  | { readonly type: 'vampirism'; readonly pct: number }
  /** Mana extra por kill. */
  | { readonly type: 'bloodthirst'; readonly mana: number }
  /** Chance de golpe do player dar dano dobrado. */
  | { readonly type: 'critical'; readonly chance: number }
  /** Chance de revidar com golpe básico ao apanhar de um adjacente. */
  | { readonly type: 'counter'; readonly chance: number }
  /** Dano recebido reduzido (mínimo 1). */
  | { readonly type: 'iron-skin'; readonly reduction: number }
  /** Gold e XP extras por kill. */
  | { readonly type: 'hunter'; readonly gold: number; readonly xp: number };

export type CardDef =
  | { readonly kind: 'skill'; readonly skillId: SkillId; readonly rarity: CardRarity }
  | {
      readonly kind: 'boon';
      readonly name: string;
      readonly description: string;
      readonly rarity: CardRarity;
      readonly maxStacks: number;
      readonly effect: CardEffect;
    };

export const CARDS = {
  // --- skills (Wound Cleansing é a mais rara: única cura fora de poção)
  skillBrutalStrike: { kind: 'skill', skillId: 'brutalStrike', rarity: 'common' },
  skillBerserk: { kind: 'skill', skillId: 'berserk', rarity: 'rare' },
  skillWhirlwindThrow: { kind: 'skill', skillId: 'whirlwindThrow', rarity: 'rare' },
  skillWoundCleansing: { kind: 'skill', skillId: 'woundCleansing', rarity: 'epic' },

  // --- stats
  might: { kind: 'boon', name: 'Força', description: '+15% ATK', rarity: 'common', maxStacks: 5, effect: { type: 'atk-pct', pct: 0.15 } },
  vigor: { kind: 'boon', name: 'Vigor', description: '+20 HP máximo e cura 20', rarity: 'common', maxStacks: 5, effect: { type: 'max-hp', amount: 20 } },
  guard: { kind: 'boon', name: 'Guarda', description: '+2 DEF', rarity: 'common', maxStacks: 5, effect: { type: 'def', amount: 2 } },
  focus: { kind: 'boon', name: 'Foco', description: '+15 mana máxima', rarity: 'common', maxStacks: 3, effect: { type: 'max-mana', amount: 15 } },

  // --- passivas
  vampirism: { kind: 'boon', name: 'Vampirismo', description: 'Cura 15% do dano causado', rarity: 'rare', maxStacks: 1, effect: { type: 'vampirism', pct: 0.15 } },
  bloodthirst: { kind: 'boon', name: 'Sede de Sangue', description: '+3 mana por kill', rarity: 'common', maxStacks: 3, effect: { type: 'bloodthirst', mana: 3 } },
  critical: { kind: 'boon', name: 'Golpe Crítico', description: '15% de chance de dano ×2', rarity: 'rare', maxStacks: 2, effect: { type: 'critical', chance: 0.15 } },
  counter: { kind: 'boon', name: 'Contra-ataque', description: '25% de chance de revidar ao apanhar', rarity: 'rare', maxStacks: 1, effect: { type: 'counter', chance: 0.25 } },
  ironSkin: { kind: 'boon', name: 'Pele de Ferro', description: '−2 de dano recebido (mín. 1)', rarity: 'rare', maxStacks: 2, effect: { type: 'iron-skin', reduction: 2 } },
  hunter: { kind: 'boon', name: 'Caçador', description: '+1 gold e +2 XP por kill', rarity: 'common', maxStacks: 3, effect: { type: 'hunter', gold: 1, xp: 2 } },
} as const satisfies Record<string, CardDef>;

export type CardId = keyof typeof CARDS;

export function getCard(id: CardId): CardDef {
  return CARDS[id];
}
