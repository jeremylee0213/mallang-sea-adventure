import { ITEM_DEFINITIONS } from '../data/items';
import type {
  Inventory,
  ItemDefinition,
  ItemId,
  ItemRuntimeState,
  ItemUseResult,
} from '../types';

function emptyRecord(): Record<ItemId, number> {
  return {
    starlightCompass: 0,
    tailwindBottle: 0,
    seaMagnet: 0,
    timeBubble: 0,
    healingApple: 0,
    shieldShell: 0,
  };
}

function safeCount(value: unknown, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.floor(value)));
}

export class ItemManager {
  private readonly definitions: ReadonlyMap<ItemId, ItemDefinition>;
  private readonly inventory: Inventory;
  private readonly cooldowns = emptyRecord();
  private readonly activeEffects = emptyRecord();

  constructor(
    initialInventory: Partial<Inventory> = {},
    definitions: readonly ItemDefinition[] = ITEM_DEFINITIONS,
  ) {
    this.definitions = new Map(definitions.map((definition) => [definition.id, definition]));
    this.inventory = emptyRecord();

    for (const definition of definitions) {
      this.inventory[definition.id] = safeCount(initialInventory[definition.id], definition.maxStack);
    }
  }

  use(itemId: ItemId): ItemUseResult {
    const definition = this.definitions.get(itemId);
    if (!definition) return this.result(itemId, false, 'unknown-item');
    if (this.inventory[itemId] <= 0) return this.result(itemId, false, 'empty');
    if (this.cooldowns[itemId] > 0) return this.result(itemId, false, 'cooldown');

    this.inventory[itemId] = Math.max(0, this.inventory[itemId] - 1);
    this.cooldowns[itemId] = definition.cooldownSeconds;
    this.activeEffects[itemId] = definition.durationSeconds;
    return this.result(itemId, true, 'used');
  }

  tick(deltaSeconds: number): ItemRuntimeState {
    const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    for (const definition of this.definitions.values()) {
      const id = definition.id;
      this.cooldowns[id] = Math.max(0, this.cooldowns[id] - delta);
      this.activeEffects[id] = Math.max(0, this.activeEffects[id] - delta);
    }
    return this.getState();
  }

  add(itemId: ItemId, amount = 1): number {
    const definition = this.definitions.get(itemId);
    if (!definition || !Number.isFinite(amount) || amount <= 0) return this.inventory[itemId] ?? 0;
    this.inventory[itemId] = Math.min(
      definition.maxStack,
      this.inventory[itemId] + Math.floor(amount),
    );
    return this.inventory[itemId];
  }

  getInventory(): Inventory {
    return { ...this.inventory };
  }

  getState(): ItemRuntimeState {
    return {
      inventory: this.getInventory(),
      cooldowns: { ...this.cooldowns },
      activeEffects: { ...this.activeEffects },
    };
  }

  private result(
    itemId: ItemId,
    success: boolean,
    reason: ItemUseResult['reason'],
  ): ItemUseResult {
    return {
      success,
      itemId,
      reason,
      remaining: this.inventory[itemId] ?? 0,
      cooldownRemaining: this.cooldowns[itemId] ?? 0,
      activeRemaining: this.activeEffects[itemId] ?? 0,
    };
  }
}
