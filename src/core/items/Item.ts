/**
 * Itens como dado. Drop universal, equip restrito (handoff §2.5):
 * qualquer vocação pega qualquer item, mas só equipa se `equipTags`
 * tiver a vocação dela ou 'ALL'. O resto vai pra aba "Pra vender".
 */

export type Vocation = 'KNIGHT' | 'SORCERER' | 'PALADIN' | 'DRUID';

/** Paper doll de 8 slots (handoff §2.8). Relíquias ficam à parte (Marco 4). */
export type EquipSlot = 'helmet' | 'amulet' | 'armor' | 'ring' | 'weapon' | 'shield' | 'legs' | 'boots';

export interface EquipmentDef {
  readonly kind: 'equipment';
  readonly name: string;
  readonly slot: EquipSlot;
  readonly atk: number;
  readonly def: number;
  readonly equipTags: readonly (Vocation | 'ALL')[];
  /** Valor base em gold (a loja do Marco 4 paga 30% na venda). */
  readonly value: number;
}

export type PotionEffect =
  | { readonly type: 'heal'; readonly pct: number }
  | { readonly type: 'mana'; readonly pct: number };

export interface PotionDef {
  readonly kind: 'potion';
  readonly name: string;
  readonly effect: PotionEffect;
  readonly value: number;
}

export type ItemDef = EquipmentDef | PotionDef;

export function canEquip(item: ItemDef, vocation: Vocation): item is EquipmentDef {
  return item.kind === 'equipment' && (item.equipTags.includes(vocation) || item.equipTags.includes('ALL'));
}

/** Quanto um equipamento soma. Usado pra decidir o auto-equip. */
export function equipmentScore(item: EquipmentDef): number {
  return item.atk + item.def;
}
