import type { ModeId } from '@cringe-court/core';
import type { Accessory, Effect, HairStyle, Outfit } from '@cringe-court/scene/roam';
import type { MessageKey } from '@/i18n';

/** Catalog keys for every wardrobe option and trial: a new option fails to compile until it has copy. */
export const OUTFIT_KEYS: Readonly<Record<Outfit, MessageKey>> = {
  suit: 'play.outfit.suit',
  robe: 'play.outfit.robe',
  hoodie: 'play.outfit.hoodie',
  tee: 'play.outfit.tee',
  coat: 'play.outfit.coat',
  vest: 'play.outfit.vest',
};

export const HAIR_KEYS: Readonly<Record<HairStyle, MessageKey>> = {
  messy: 'play.hair.messy',
  short: 'play.hair.short',
  long: 'play.hair.long',
  buzz: 'play.hair.buzz',
  bun: 'play.hair.bun',
  mohawk: 'play.hair.mohawk',
  curly: 'play.hair.curly',
};

export const ACCESSORY_KEYS: Readonly<Record<Accessory, MessageKey>> = {
  none: 'play.accessory.none',
  glasses: 'play.accessory.glasses',
  shades: 'play.accessory.shades',
  cap: 'play.accessory.cap',
  wig: 'play.accessory.wig',
  crown: 'play.accessory.crown',
  headphones: 'play.accessory.headphones',
};

export const EFFECT_KEYS: Readonly<Record<Effect, MessageKey>> = {
  none: 'play.effect.none',
  aura: 'play.effect.aura',
  halo: 'play.effect.halo',
  sparkles: 'play.effect.sparkles',
  embers: 'play.effect.embers',
};

export const MODE_KEYS: Readonly<Record<ModeId, MessageKey>> = {
  solo: 'play.mode.solo',
  versus: 'play.mode.versus',
  'grand-jury': 'play.mode.grand-jury',
};
