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

/**
 * Marco 4 (decisão do Felipe): monstros com stats fixos; o andar fica mais
 * difícil pela MISTURA (peso de cada monstro) e pela LOTAÇÃO (monstros por
 * sala). A sala inicial sempre começa vazia. Índice = andar (1–5).
 */
export const FLOOR_SPAWNS: Readonly<
  Record<number, { readonly perRoom: { readonly min: number; readonly max: number }; readonly weights: Readonly<Partial<Record<'rat' | 'goblin' | 'skeleton' | 'orc', number>>> }>
> = {
  1: { perRoom: { min: 0, max: 2 }, weights: { rat: 60, goblin: 40 } },
  2: { perRoom: { min: 0, max: 2 }, weights: { rat: 25, goblin: 50, skeleton: 25 } },
  3: { perRoom: { min: 0, max: 3 }, weights: { goblin: 35, skeleton: 45, orc: 20 } },
  4: { perRoom: { min: 1, max: 3 }, weights: { skeleton: 50, orc: 50 } },
  5: { perRoom: { min: 1, max: 3 }, weights: { skeleton: 35, orc: 65 } },
};

// ------------------------------------------------------------ mercador e loja

/** Merchant Room garantida nesses andares (2 a 5: a do 5 prepara pro boss). */
export const MERCHANT_FLOORS: readonly number[] = [2, 3, 4, 5];

/**
 * Loja (§5 Marco 4): compra a 100% do valor, venda a 30%. Item da vocação
 * (feito pro Knight, não 'ALL') vende por +10% e compra por +10% (decisão
 * do Felipe: as duas coisas). Estoque: poções sempre, mais 3 equipamentos
 * do nível do andar e 1 relíquia que o player ainda não tem.
 */
export const SHOP = {
  buyRate: 1,
  sellRate: 0.3,
  vocationBonus: 0.1,
  equipmentStock: 3,
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

// ------------------------------------------------------------ fog of war

/**
 * Visão (Marco 3): dentro de uma sala o Knight vê a sala inteira (com as
 * paredes e as portas). No corredor, vê até essa distância andando pelo chão
 * (não enxerga através de parede).
 */
export const CORRIDOR_VISION = 2;

// ------------------------------------------------------- meta-progressão (Marco 5)

/**
 * Sanctum (decisões do Felipe, Marco 5; números provisórios até o Marco 6).
 * - Conversão do gold que sobrou no fim da run: vitória 100%; morte (ou run
 *   abandonada) 50%, e o The Vault sobe isso. Gastar no mercador compete
 *   com guardar pro Sanctum, de propósito.
 * - Cada upgrade tem até 3 níveis; `costs[n]` é o preço do nível n + 1.
 * - Sem upgrade de DEF: o empilhamento de DEF já é o risco da §2.12.
 */
export const META = {
  winConversion: 1,
  /**
   * Conversão na morte por nível do The Vault (0–3). O plano dizia
   * "50% → 65% → 80%" com 3 preços: ficou 50 → 60 → 70 → 80 (teto 80%).
   */
  deathConversion: [0.5, 0.6, 0.7, 0.8],
  costs: {
    vault: [60, 150, 300],
    sharpen: [80, 160, 320],
    reinforce: [60, 120, 240],
    wisdom: [100, 200, 350],
    reread: [50, 100, 200],
  },
  /** Ancient Armory: por nível. */
  sharpenAtk: 1,
  reinforceHp: 10,
  /** Tome "Saber" nível 3: XP extra por kill. */
  wisdomXpPct: 0.15,
  /** Tome "Releitura": rerrolagens da escolha de carta por run = nível. */
  rerollsPerLevel: 1,
} as const;
