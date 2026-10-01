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
export const PLACEHOLDER_ENEMY_GROWTH = { hpPerFloor: 5, atkPerFloor: 2 } as const;

/** Monstro só persegue quem estiver a até essa distância (Manhattan). */
export const AGGRO_RANGE = 7;
