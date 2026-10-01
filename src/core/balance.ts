/**
 * Números de balanceamento do core. Tudo que o Marco 6 vai querer ajustar
 * fica aqui, não espalhado pelo código.
 */

/** Variação do dano em torno do ATK: 0.25 → ATK×0,75 até ATK×1,25. */
export const DAMAGE_VARIANCE = 0.25;

/** Piso de dano: nenhum ataque que acerta dá menos que isso (evita lockout). */
export const MIN_DAMAGE = 1;

// --------------------------------------------------------------- run e andares

/** Andar final. Descer a escada dele termina a run (Marco 4: lá mora o Orc Warlord). */
export const FINAL_FLOOR = 5;

/**
 * Gerador BSP. Mapa de 44×32 com folhas de no mínimo 10 tiles rende 6–12
 * salas por andar (8 é o mais comum, medido em 500 seeds) — "a cada 5 salas
 * exploradas" (Training Room, Marco 2b) acontece mais ou menos a cada andar.
 */
export const DUNGEON = {
  width: 44,
  height: 32,
  /** Menor lado de uma folha do BSP (sala + 1 de parede de cada lado). */
  minLeaf: 10,
  minRoomSize: 4,
  maxRoomSize: 10,
} as const;

/** Monstros por sala (a sala inicial sempre começa vazia). */
export const ENEMIES_PER_ROOM = { min: 0, max: 2 } as const;

/**
 * PROVISÓRIO (Marco 2): o Goblin dummy cresce por andar só pra testar o loop.
 * Os monstros reais (Rat/Skeleton/Goblin/Orc) com stats próprios chegam no Marco 4.
 */
export const PLACEHOLDER_ENEMY_GROWTH = {
  hpPerFloor: 10,
  atkPerFloor: 4,
  xpPerFloor: 2,
  goldPerFloor: 1,
} as const;

/** Monstro só persegue quem estiver a até essa distância (Manhattan). */
export const AGGRO_RANGE = 7;

// ------------------------------------------------------- Knight e progressão

/** Mana máxima inicial do Knight (handoff §7, Marco 2). */
export const KNIGHT_START_MANA = 30;

/**
 * Mana vem de LUTAR, não de esperar (Marco 2c): cada kill do player rende
 * isso. Não existe regen por turno — com ele, ficar parado virava mana de
 * graça e a Wound Cleansing virava HP infinito. HP também não regenera.
 */
export const MANA_PER_KILL = 4;

/**
 * XP pro próximo nível = XP_BASE + XP_STEP × (nível − 1).
 * Marco 2d: curva mais baixa (era 20 × nível) pra render ~8 níveis por região
 * — cada nível é uma escolha de carta, então nível raro = build parado.
 */
export const XP_CURVE = { base: 8, step: 3 } as const;

/** Level up: +10 HP max, +10 Mana max e uma escolha de carta (Marco 2d). */
export const LEVEL_UP_GAIN = { maxHp: 10, maxMana: 10 } as const;

/** Cartas oferecidas por level up, e o peso de cada raridade no sorteio. */
export const CARD_OFFER_SIZE = 3;
export const CARD_RARITY_WEIGHTS = { common: 60, rare: 30, epic: 10 } as const;

/** Passiva do Knight: cura por kill. */
export const KILL_HEAL = 2;

/**
 * Poções caem de qualquer monstro, sorteio independente do loot.
 * HP: rara (5%, decisão do Felipe) porque é a única cura fora da skill.
 * Mana: mais comum (8%) e mais fraca em valor — 50% da mana inicial (15)
 * paga 1,5 Wound Cleansing ≈ 19 HP, menos que a poção de HP (25 HP no início).
 */
export const POTION_DROP_CHANCE = { hpPotion: 0.05, manaPotion: 0.08 } as const;

/**
 * Training Room: a cada N salas exploradas (entrou e matou os monstros dela).
 * Era 5 (§2.7 original). Marco 2d: meta de 0,5 sala de treino por andar
 * pra quem explora (~8 salas por andar → 16). Regra implícita de propósito:
 * quem explora ganha mais, e o jogador não sabe quando vai aparecer.
 */
export const ROOMS_PER_TRAINING = 16;
export const TRAINING_BONUS = 2;
