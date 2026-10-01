/**
 * Números de balanceamento do core. Tudo que o Marco 6 vai querer ajustar
 * fica aqui, não espalhado pelo código.
 */

/** Variação do dano em torno do ATK: 0.25 → ATK×0,75 até ATK×1,25. */
export const DAMAGE_VARIANCE = 0.25;

/** Piso de dano: nenhum ataque que acerta dá menos que isso (evita lockout). */
export const MIN_DAMAGE = 1;
