import type { ItemId } from '../types';

export type ItemContext = 'sailing' | 'island';

const SAILING_ITEMS: readonly ItemId[] = [
  'starlightCompass', 'tailwindBottle', 'seaMagnet', 'timeBubble',
];

const ISLAND_ITEMS: readonly ItemId[] = [
  'healingApple', 'shieldShell', 'timeBubble',
];

export function itemIdsForContext(context: ItemContext): readonly ItemId[] {
  return context === 'island' ? ISLAND_ITEMS : SAILING_ITEMS;
}

export function itemIsUsableInContext(itemId: ItemId, context: ItemContext): boolean {
  return itemIdsForContext(context).includes(itemId);
}
